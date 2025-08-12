import { interrupt } from "@langchain/langgraph";
import { MemorySaver } from "@langchain/langgraph-checkpoint";
import { ReactAgent } from "./index.js";
import { resume } from "./resume.js";

export class Thread {
  #agent: ReactAgent;

  #interruptCallbacks = new Set<(reason: string) => void | Promise<void>>();

  checkpointer = new MemorySaver();

  configurable = {
    thread_id: "conversation-1",
  };

  set agent(agent: ReactAgent) {
    this.#agent = agent;
  }

  async getState() {
    const tuple = await this.checkpointer.getTuple({
      configurable: this.configurable,
    });
    return tuple;
  }

  interrupt(reason: string) {
    setTimeout(() => {
      for (const callback of this.#interruptCallbacks) {
        callback(reason);
      }
    }, 0);
    return interrupt({ reason });
  }

  async applyState(state: any) {
    if (!this.#agent) {
      throw new Error("thread is not associated with an agent");
    }

    const { config: stateConfig, values } = state;
    // @ts-expect-error
    await this.#agent.updateState(stateConfig, values, "tools");
  }

  on(event: "interrupt", callback: (reason: string) => void | Promise<void>) {
    if (event === "interrupt") {
      this.#interruptCallbacks.add(callback);
      return;
    }

    throw new Error(`Invalid event: ${event}`);
  }

  resume(message: string) {
    if (!this.#agent) {
      throw new Error("thread is not associated with an agent");
    }

    return this.#agent.invoke(resume(message), {
      configurable: this.configurable,
    }) as any;
  }
}
