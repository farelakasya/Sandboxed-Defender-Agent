/**
 * Minimal Bedrock Agent Action Group event/response types. These mirror the
 * shape AWS sends to (and expects back from) a Lambda action group, without
 * pulling in the full aws-lambda type package.
 */
export interface BedrockAgentEventParameter {
  name: string;
  type: string;
  value: string;
}

export interface BedrockAgentEvent {
  messageVersion: string;
  agent?: {
    name?: string;
    id?: string;
    alias?: string;
    version?: string;
  };
  actionGroup: string;
  apiPath: string;
  httpMethod: string;
  parameters?: BedrockAgentEventParameter[];
  requestBody?: {
    content?: {
      [contentType: string]: {
        // Bedrock may send either properties[] or a raw body string.
        properties?: BedrockAgentEventParameter[];
        body?: string;
      };
    };
  };
}

export interface BedrockAgentResponse {
  messageVersion: "1.0";
  response: {
    actionGroup: string;
    apiPath: string;
    httpMethod: string;
    httpStatusCode: number;
    responseBody: {
      "application/json": {
        body: string;
      };
    };
  };
}

/** Build a Bedrock-Agent-compatible response envelope. */
export function bedrockResponse(
  event: BedrockAgentEvent,
  result: unknown,
  httpStatusCode = 200
): BedrockAgentResponse {
  return {
    messageVersion: "1.0",
    response: {
      actionGroup: event.actionGroup,
      apiPath: event.apiPath,
      httpMethod: event.httpMethod,
      httpStatusCode,
      responseBody: {
        "application/json": {
          body: JSON.stringify(result),
        },
      },
    },
  };
}

/** Extract a JSON request body from a Bedrock event (handles both shapes). */
export function parseRequestBody<T = Record<string, unknown>>(
  event: BedrockAgentEvent
): T {
  const content = event.requestBody?.content?.["application/json"];
  if (!content) {
    // Fall back to flat parameters[].
    const params = event.parameters ?? [];
    return Object.fromEntries(params.map((p) => [p.name, coerce(p)])) as T;
  }
  if (typeof content.body === "string") {
    try {
      return JSON.parse(content.body) as T;
    } catch {
      return {} as T;
    }
  }
  const props = content.properties ?? [];
  return Object.fromEntries(props.map((p) => [p.name, coerce(p)])) as T;
}

/** Extract a single named path/query parameter from a Bedrock event. */
export function getParameter(
  event: BedrockAgentEvent,
  name: string
): string | undefined {
  const p = (event.parameters ?? []).find((x) => x.name === name);
  return p?.value;
}

function coerce(p: BedrockAgentEventParameter): unknown {
  switch (p.type) {
    case "number":
    case "integer":
      return Number(p.value);
    case "boolean":
      return p.value === "true";
    default:
      return p.value;
  }
}
