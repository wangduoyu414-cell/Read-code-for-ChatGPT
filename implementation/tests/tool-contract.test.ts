/**
 * Public tool contract tests.
 * Keep the runtime registry and root tool-schemas.json aligned.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CONFIG } from "../src/config.js";
import { getToolRegistrations } from "../src/tools/registry.js";

interface ToolSchemaEntry {
  name: string;
  title: string;
  description: string;
  annotations: {
    readOnlyHint: boolean;
    destructiveHint: boolean;
    openWorldHint: boolean;
  };
  _meta: Record<string, unknown>;
  inputSchema: {
    required?: string[];
    properties?: Record<string, unknown>;
  };
  outputSchema?: {
    required?: string[];
    properties?: Record<string, unknown>;
  };
}

interface ToolSchemaFile {
  tools: ToolSchemaEntry[];
  $defs?: Record<string, unknown>;
}

const schema = JSON.parse(
  readFileSync(new URL("../../tool-schemas.json", import.meta.url), "utf-8"),
) as ToolSchemaFile;

const runtimeTools = getToolRegistrations();
const schemaToolsByName = new Map(schema.tools.map((tool) => [tool.name, tool]));

function inputProperty(toolName: string, propertyName: string): Record<string, unknown> {
  const tool = schemaToolsByName.get(toolName);
  assert.ok(tool, `${toolName} must exist in tool-schemas.json`);
  const property = tool.inputSchema.properties?.[propertyName];
  assert.equal(typeof property, "object", `${toolName}.${propertyName} must be an object`);
  assert.notEqual(property, null, `${toolName}.${propertyName} must not be null`);
  assert.equal(Array.isArray(property), false, `${toolName}.${propertyName} must not be an array`);
  return property as Record<string, unknown>;
}

function assertOptionalMaximum(toolName: string, propertyName: string, expected: number | null): void {
  const property = inputProperty(toolName, propertyName);
  if (expected === null) {
    assert.equal("maximum" in property, false, `${toolName}.${propertyName} must not expose a maximum when the bound is disabled`);
    return;
  }
  assert.equal(property.maximum, expected);
}

function outputProperty(toolName: string, propertyName: string): Record<string, unknown> {
  const tool = schemaToolsByName.get(toolName);
  assert.ok(tool, `${toolName} must exist in tool-schemas.json`);
  const property = tool.outputSchema?.properties?.[propertyName];
  assert.equal(typeof property, "object", `${toolName}.${propertyName} output must be an object`);
  assert.notEqual(property, null, `${toolName}.${propertyName} output must not be null`);
  assert.equal(Array.isArray(property), false, `${toolName}.${propertyName} output must not be an array`);
  return property as Record<string, unknown>;
}

function assertChatGptToolMeta(toolName: string, meta: Record<string, unknown>): void {
  assert.deepEqual((meta.ui as { visibility?: unknown } | undefined)?.visibility, ["model", "app"], `${toolName} must be visible to the model`);
  assert.equal(meta["openai/visibility"], "public", `${toolName} must be public to ChatGPT`);
  assert.equal(typeof meta["openai/toolInvocation/invoking"], "string", `${toolName} must define invoking status text`);
  assert.equal(typeof meta["openai/toolInvocation/invoked"], "string", `${toolName} must define invoked status text`);
  assert.deepEqual(meta.securitySchemes, [{ type: "noauth" }], `${toolName} must mirror noauth security metadata`);
}

await describe("Public tool contract", async () => {
  await it("keeps runtime tool names aligned with tool-schemas.json", () => {
    assert.deepEqual(
      runtimeTools.map((tool) => tool.name),
      schema.tools.map((tool) => tool.name),
    );
  });

  await it("exposes compatibility wrappers for cached ChatGPT tool imports", () => {
    assert.equal(runtimeTools.some((tool) => tool.name === "read_code"), true);
    assert.equal(runtimeTools.some((tool) => tool.name === "api_tool"), true);
    assert.equal(schema.tools.some((tool) => tool.name === "read_code"), true);
    assert.equal(schema.tools.some((tool) => tool.name === "api_tool"), true);
  });

  await it("does not expose dotted public tool names", () => {
    assert.equal(runtimeTools.some((tool) => tool.name.includes(".")), false);
    assert.equal(schema.tools.some((tool) => tool.name.includes(".")), false);
  });

  await it("keeps titles, descriptions, and annotations aligned", () => {
    for (const runtimeTool of runtimeTools) {
      const schemaTool = schemaToolsByName.get(runtimeTool.name);
      assert.ok(schemaTool, `${runtimeTool.name} must exist in tool-schemas.json`);
      assert.equal(schemaTool.title, runtimeTool.title);
      assert.equal(schemaTool.description, runtimeTool.description);
      assert.deepEqual(schemaTool.annotations, runtimeTool.annotations);
      assert.deepEqual(schemaTool._meta, runtimeTool._meta);
      assertChatGptToolMeta(runtimeTool.name, runtimeTool._meta);
    }
  });

  await it("keeps documented static input limits aligned with CONFIG", () => {
    const search = schemaToolsByName.get(CONFIG.tools.search.name);
    const files = schemaToolsByName.get(CONFIG.tools.files.name);
    const fetch = schemaToolsByName.get(CONFIG.tools.fetch.name);
    const tree = schemaToolsByName.get(CONFIG.tools.tree.name);
    const symbols = schemaToolsByName.get(CONFIG.tools.symbols.name);
    const refresh = schemaToolsByName.get(CONFIG.tools.refresh.name);

    assert.deepEqual(search?.inputSchema.required, ["query"]);
    assert.deepEqual(files?.inputSchema.required, []);
    assert.deepEqual(fetch?.inputSchema.required, ["path", "line_start", "line_end", "purpose"]);
    assert.deepEqual(tree?.inputSchema.required, []);
    assert.deepEqual(symbols?.inputSchema.required, ["query"]);
    assert.deepEqual(refresh?.inputSchema.required, []);

    assert.equal(inputProperty(CONFIG.tools.search.name, "query").maxLength, CONFIG.tools.search.queryMaxLength);
    assert.equal(inputProperty(CONFIG.tools.search.name, "limit").default, CONFIG.tools.search.defaultLimit);
    assertOptionalMaximum(CONFIG.tools.search.name, "limit", CONFIG.tools.search.maxLimit);

    assert.equal(inputProperty(CONFIG.tools.files.name, "prefix").maxLength, CONFIG.tools.files.prefixMaxLength);
    assert.equal(inputProperty(CONFIG.tools.files.name, "suffixes").maxItems, CONFIG.tools.files.filterMaxItems);
    assert.equal(inputProperty(CONFIG.tools.files.name, "languages").maxItems, CONFIG.tools.files.filterMaxItems);
    assert.equal(inputProperty(CONFIG.tools.files.name, "states").maxItems, 3);
    assert.equal(inputProperty(CONFIG.tools.files.name, "cursor").maxLength, CONFIG.tools.files.cursorMaxLength);
    assert.equal(inputProperty(CONFIG.tools.files.name, "limit").default, CONFIG.tools.files.defaultLimit);
    assertOptionalMaximum(CONFIG.tools.files.name, "limit", CONFIG.tools.files.maxLimit);

    assert.equal(inputProperty(CONFIG.tools.fetch.name, "path").maxLength, CONFIG.tools.fetch.pathMaxLength);
    assert.equal(inputProperty(CONFIG.tools.fetch.name, "purpose").maxLength, CONFIG.tools.fetch.purposeMaxLength);

    assert.equal(inputProperty(CONFIG.tools.tree.name, "depth").default, CONFIG.tools.tree.defaultDepth);
    assertOptionalMaximum(CONFIG.tools.tree.name, "depth", CONFIG.tools.tree.maxDepth);
    assert.equal(inputProperty(CONFIG.tools.tree.name, "limit").default, CONFIG.tools.tree.defaultLimit);
    assertOptionalMaximum(CONFIG.tools.tree.name, "limit", CONFIG.tools.tree.maxLimit);

    assert.equal(inputProperty(CONFIG.tools.symbols.name, "query").maxLength, CONFIG.tools.symbols.queryMaxLength);
    assert.equal(inputProperty(CONFIG.tools.symbols.name, "limit").default, CONFIG.tools.symbols.defaultLimit);
    assertOptionalMaximum(CONFIG.tools.symbols.name, "limit", CONFIG.tools.symbols.maxLimit);

    assert.equal(inputProperty(CONFIG.tools.refresh.name, "reason").maxLength, CONFIG.tools.refresh.reasonMaxLength);
  });

  await it("documents the first-use usage guide in public output schemas", () => {
    const safetyFields = ["content_origin", "instruction_trust", "isError", "error_code", "message", "audit_id", "retryable", "next_cursor"];
    for (const toolName of [CONFIG.tools.readCode.name, CONFIG.tools.apiTool.name, CONFIG.tools.list.name]) {
      const required = schemaToolsByName.get(toolName)?.outputSchema?.required ?? [];
      for (const field of safetyFields) {
        assert.ok(required.includes(field), `${toolName} output required must include ${field}`);
      }
      assert.deepEqual(outputProperty(toolName, "usage_guide"), { "$ref": "#/$defs/usage_guide" });
    }

    const listRequired = schemaToolsByName.get(CONFIG.tools.list.name)?.outputSchema?.required ?? [];
    assert.ok(listRequired.includes("usage_guide"), "repo_list output required must include usage_guide");
    assert.equal(typeof schema.$defs?.usage_guide, "object", "tool-schemas.json must define usage_guide");
  });
});
