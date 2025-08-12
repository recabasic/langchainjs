import fs from "fs/promises";
import { createReactAgent, tool, HumanMessage, Thread } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import z from "zod";

const model = new ChatOpenAI({ model: "gpt-4o", temperature: 0.7 });
const thread = new Thread();
thread.on("interrupt", async (reason) => {
  console.log("thread was interrupted", reason);
  return fs.writeFile(
    "state.json",
    JSON.stringify(await thread.getState(), null, 2)
  );
});

const sumTool = tool(
  async ({ a, b }: { a: number; b: number }) => {
    console.log("sumTool tool called");
    throw new Error("test");
    return a + b;
  },
  {
    name: "sum",
    description: "Sum two numbers",
    schema: z.object({ a: z.number(), b: z.number() }),
  }
);

const researchSummary = tool(
  async ({ result }: { result: string }) => {
    console.log("researchSummary tool called", result);

    if (result.includes("10")) {
      console.log("interrupt in tool");
      return thread.interrupt("user needs to verify the result");
    }

    return {
      result,
      summary: "The result indicates you should do 3 jumping jacks",
    };
  },
  {
    name: "research_summary",
    description: "Summarize the research",
    schema: z.object({ result: z.string() }),
  }
);

// let i = 0;
const agent = createReactAgent({
  llm: model,
  prompt:
    "You are a helpful math assistant. Your name is Carl. You are a math teacher.",
  tools: [sumTool, researchSummary],
  // postModelHook: (state) => {
  //   ++i;
  //   console.log("postModelHook", i);
  //   if (i === 2) {
  //     console.log("interrupt in postModelHook");
  //     return thread.interrupt("You should do 3 jumping jacks");
  //   }
  //   return state;
  // },
  thread,
});

interface InterruptPayload {
  requestFeedack: {
    triageResult: string;
  };
}
interface ResumeMessagesA {
  requestFeedack: { approved: false; feedback: string } | { approved: true };
}

if (process.argv.includes("resume")) {
  console.log("RESUME WITH STATE");
  const state = await fs.readFile("state.json", "utf-8");
  await thread.applyState(JSON.parse(state));
  const resp = await thread.resume("user is verified");
  console.log(resp.messages);

  // const { config: stateConfig, values, metadata } = JSON.parse(tuple);

  // console.log(`config:`, stateConfig);
  // console.log(`values:`, values);
  // console.log(`metadata:`, metadata);

  // // @ts-expect-error
  // await agent.updateState(stateConfig, values, "tools");

  // const resp = await agent.invoke(
  //   {
  //     messages: [new HumanMessage("What was the last result?")],
  //   },
  //   stateConfig
  // );
  // console.log(resp.messages[resp.messages.length - 1].content);
} else {
  const resp = await agent.invoke(
    {
      messages: [
        new HumanMessage(
          "Find out what is 5 + 5 and give me a summary of the result?"
        ),
      ],
    },
    thread
  );
  console.log(resp.messages);
  // console.log(hasInterrupt(resp));

  // const resp2 = await agent.invoke(
  //   {
  //     messages: [new HumanMessage("State your name?")],
  //   },
  //   config
  // );
  // console.log(
  //   resp2.messages[resp2.messages.length - 1].content,
  //   isGraphInterrupt(config),
  //   resp2.__interrupt__
  // );
  // const resp3 = await agent.invoke(
  //   {
  //     messages: [new HumanMessage("What was the last result?")],
  //   },
  //   config
  // );
  // console.log(
  //   resp3.messages[resp3.messages.length - 1].content,
  //   isGraphInterrupt(config)
  // );

  // const tuple = await agent.getState(config);
  // console.log(tuple);
  // console.log(checkpointer.storage[config.configurable.thread_id][""]);
  // await fs.writeFile("state2.json", JSON.stringify(tuple, null, 2));
}
