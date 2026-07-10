/** User-login startup integration. This module renders platform artifacts and
 * never runs as an MCP tool. */

import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { spawnSync } from "node:child_process";
import type { SupervisorConfig } from "./supervisor.js";

export const WINDOWS_TASK_NAME = "ReadCodeChatGPTSupervisor";
export const MACOS_LABEL = "com.read-code-chatgpt.supervisor";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function windowsCmdQuote(value: string): string {
  return `"${value.replace(/"/g, "\\\"")}"`;
}

export function renderWindowsTaskXml(config: SupervisorConfig): string {
  const command = `${windowsCmdQuote(config.node_path)} ${windowsCmdQuote(config.agent_entry)} run`;
  const pushdCommand = `/d /c pushd ${windowsCmdQuote(config.working_directory)} && ${command}`;
  return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Triggers><LogonTrigger><Enabled>true</Enabled></LogonTrigger></Triggers>
  <Principals><Principal id="Author"><LogonType>InteractiveToken</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal></Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <RestartOnFailure><Interval>PT1M</Interval><Count>3</Count></RestartOnFailure>
  </Settings>
  <Actions Context="Author"><Exec><Command>cmd.exe</Command><Arguments>${escapeXml(pushdCommand)}</Arguments></Exec></Actions>
</Task>`;
}

export function renderMacosLaunchAgentPlist(config: SupervisorConfig): string {
  const args = [config.node_path, config.agent_entry, "run"]
    .map((value) => `    <string>${escapeXml(value)}</string>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${MACOS_LABEL}</string>
  <key>ProgramArguments</key><array>
${args}
  </array>
  <key>WorkingDirectory</key><string>${escapeXml(config.working_directory)}</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ProcessType</key><string>Background</string>
</dict></plist>`;
}

function agentHome(): string {
  return join(homedir(), ".read-code-chatgpt");
}

export function windowsTaskXmlPath(): string {
  return join(agentHome(), "autostart", "ReadCodeChatGPTSupervisor.xml");
}

export function windowsStartupScriptPath(): string {
  const appData = process.env.APPDATA ?? join(homedir(), "AppData", "Roaming");
  return join(appData, "Microsoft", "Windows", "Start Menu", "Programs", "Startup", "ReadCodeChatGPTSupervisor.cmd");
}

export function renderWindowsStartupScript(config: SupervisorConfig): string {
  return [
    "@echo off",
    "setlocal",
    "REM The agent uses its configured working directory. Keep this launcher independent of a UNC current directory.",
    "REM Restart only after an abnormal agent exit; a normal stop intentionally ends this launcher.",
    ":run",
    `${windowsCmdQuote(config.node_path)} ${windowsCmdQuote(config.agent_entry)} run`,
    "set \"exit_code=%ERRORLEVEL%\"",
    "if \"%exit_code%\"==\"0\" exit /b 0",
    "timeout /t 5 /nobreak >nul",
    "goto run",
  ].join("\r\n");
}

export function macosLaunchAgentPath(): string {
  return join(homedir(), "Library", "LaunchAgents", `${MACOS_LABEL}.plist`);
}

export interface AutostartResult {
  installed: boolean;
  platform: NodeJS.Platform;
  artifact_path?: string;
  message: string;
}

export function installAutostart(config: SupervisorConfig, platform: NodeJS.Platform = process.platform): AutostartResult {
  if (platform === "win32") {
    const artifactPath = windowsTaskXmlPath();
    mkdirSync(join(agentHome(), "autostart"), { recursive: true });
    // Task Scheduler requires a UTF-16 BOM when the XML declaration says UTF-16.
    const xml = renderWindowsTaskXml(config);
    writeFileSync(artifactPath, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(xml, "utf16le")]));
    const result = spawnSync("schtasks.exe", ["/Create", "/TN", WINDOWS_TASK_NAME, "/XML", artifactPath, "/RU", process.env.USERNAME ?? "", "/IT", "/F"], { encoding: "utf-8", windowsHide: true });
    if (result.status !== 0) {
      const fallbackPath = windowsStartupScriptPath();
      mkdirSync(join(fallbackPath, ".."), { recursive: true });
      writeFileSync(fallbackPath, renderWindowsStartupScript(config), "utf-8");
      return {
        installed: true,
        platform,
        artifact_path: fallbackPath,
        message: "Task Scheduler was unavailable; installed the current-user Startup folder fallback. The local supervisor still performs dependency health recovery.",
      };
    }
    return { installed: true, platform, artifact_path: artifactPath, message: "Windows user-logon task installed." };
  }

  if (platform === "darwin") {
    const artifactPath = macosLaunchAgentPath();
    mkdirSync(join(homedir(), "Library", "LaunchAgents"), { recursive: true });
    writeFileSync(artifactPath, renderMacosLaunchAgentPlist(config), "utf-8");
    const uid = process.getuid?.();
    const domain = uid === undefined ? "gui/$(id -u)" : `gui/${uid}`;
    const result = spawnSync("launchctl", ["bootstrap", domain, artifactPath], { encoding: "utf-8" });
    if (result.status !== 0 && !result.stderr.includes("already bootstrapped")) {
      return { installed: false, platform, artifact_path: artifactPath, message: result.stderr.trim() || result.stdout.trim() || "launchctl bootstrap failed" };
    }
    spawnSync("launchctl", ["kickstart", "-k", `${domain}/${MACOS_LABEL}`], { encoding: "utf-8" });
    return { installed: true, platform, artifact_path: artifactPath, message: "macOS user LaunchAgent installed." };
  }

  return { installed: false, platform, message: "User-login startup is supported only on Windows and macOS." };
}

export function uninstallAutostart(platform: NodeJS.Platform = process.platform): AutostartResult {
  if (platform === "win32") {
    const result = spawnSync("schtasks.exe", ["/Delete", "/TN", WINDOWS_TASK_NAME, "/F"], { encoding: "utf-8", windowsHide: true });
    const artifactPath = windowsTaskXmlPath();
    const fallbackPath = windowsStartupScriptPath();
    if (existsSync(artifactPath)) rmSync(artifactPath, { force: true });
    if (existsSync(fallbackPath)) rmSync(fallbackPath, { force: true });
    const absent = result.status === 0 || /cannot find/i.test(result.stderr);
    return { installed: false, platform, artifact_path: artifactPath, message: absent ? "Windows user-logon task and Startup fallback removed." : "Windows Startup fallback removed; Task Scheduler task could not be removed by this account." };
  }

  if (platform === "darwin") {
    const artifactPath = macosLaunchAgentPath();
    const uid = process.getuid?.();
    const domain = uid === undefined ? "gui/$(id -u)" : `gui/${uid}`;
    spawnSync("launchctl", ["bootout", `${domain}/${MACOS_LABEL}`], { encoding: "utf-8" });
    if (existsSync(artifactPath)) rmSync(artifactPath, { force: true });
    return { installed: false, platform, artifact_path: artifactPath, message: "macOS user LaunchAgent removed." };
  }

  return { installed: false, platform, message: "User-login startup is supported only on Windows and macOS." };
}
