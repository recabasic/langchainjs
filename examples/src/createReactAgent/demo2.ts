import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";

const model = new ChatOpenAI({
  model: "gpt-4o",
});

const getWeather = tool(
  (input) => {
    if (["sf", "san francisco"].includes(input.location.toLowerCase())) {
      return "It's always sunny in sf";
    } else if (
      ["nyc", "new york city"].includes(input.location.toLowerCase())
    ) {
      return "It might be cloudy in nyc";
    } else {
      throw new Error("Unknown Location");
    }
  },
  {
    name: "get_weather",
    description: "Call to get the current weather in a given location.",
    schema: z.object({
      location: z.string().describe("Location to get the weather for."),
    }),
  }
);

// Here we only save in-memory
const memory = new MemorySaver();

const agent = createReactAgent({
  llm: model,
  tools: [getWeather],
  interruptBefore: ["tools"],
  checkpointSaver: memory,
});

const inputs = {
  messages: [
    { role: "user", content: "what is the weather in SF california?" },
  ],
};
const config = { configurable: { thread_id: "1" } };

let stream = await agent.stream(inputs, {
  ...config,
  streamMode: "values",
});

for await (const { messages } of stream) {
  const msg = messages[messages?.length - 1];
  if (msg?.content) {
    console.log(msg.content);
  }
  if (msg?.tool_calls?.length > 0) {
    console.log(msg.tool_calls);
  }
  console.log("-----\n");
}

const state = await agent.getState(config);
console.log(state.next);

stream = await agent.stream(null, {
  ...config,
  streamMode: "values",
});

for await (const { messages } of stream) {
  const msg = messages[messages?.length - 1];
  if (msg?.content) {
    console.log(msg.content);
  }
  if (msg?.tool_calls?.length > 0) {
    console.log(msg.tool_calls);
  }
  console.log("-----\n");
}

// First, lets get the current state
const currentState = await agent.getState(config);

// Let's now get the last message in the state
// This is the one with the tool calls that we want to update
const lastMessage =
  currentState.values.messages[currentState.values.messages.length - 1];

// Let's now update the args for that tool call
lastMessage.tool_calls[0].args = { location: "San Francisco" };

// Let's now call `updateState` to pass in this message in the `messages` key
// This will get treated as any other update to the state
// It will get passed to the reducer function for the `messages` key
// That reducer function will use the ID of the message to update it
// It's important that it has the right ID! Otherwise it would get appended
// as a new message
await agent.updateState(config, { messages: lastMessage });

stream = await agent.stream(null, {
  ...config,
  streamMode: "values",
});

for await (const { messages } of stream) {
  const msg = messages[messages?.length - 1];
  if (msg?.content) {
    console.log(msg.content);
  }
  if (msg?.tool_calls?.length > 0) {
    console.log(msg.tool_calls);
  }
  console.log("-----\n");
}
