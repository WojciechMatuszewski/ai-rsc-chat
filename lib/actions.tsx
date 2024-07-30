"use server";

import { Suspense } from "react";
import { setTimeout } from "timers/promises";

const getWeather = async () => {
  await setTimeout(2_000);
  return "20 degree celsius";
};

async function* generateWeatherComponent({ location }: { location: string }) {
  yield <span>Loading...</span>;

  const weather = await getWeather();

  return (
    <div className={"max-w-md w-full border border-red-100"}>
      <p>Weather in Poznan is {weather}</p>
      <span>{location}</span>
    </div>
  );
}

async function Recursive({
  current,
  next
}: {
  current: React.ReactNode;
  next: Promise<any>;
}) {
  const chunk = await next;
  if (chunk.done) {
    return chunk.value;
  }

  if (chunk.append) {
    return (
      <>
        {current}
        <Suspense fallback={chunk.value}>
          <Recursive current={chunk.value} next={chunk.next} />
        </Suspense>
      </>
    );
  }

  console.log("im here", chunk.value, chunk.next);

  return (
    <Suspense fallback={chunk.value}>
      <Recursive current={chunk.value} next={chunk.next} />
    </Suspense>
  );
}

function createResolvablePromise() {
  let resolve: (value: unknown) => void;
  let reject: (reason: any) => void;

  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve: resolve!, reject: reject! };
}

function createSuspendedChunk() {
  const { resolve, reject, promise } = createResolvablePromise();

  return {
    ui: (
      <Suspense>
        <Recursive current={null} next={promise} />
      </Suspense>
    ),
    resolve,
    reject
  };
}

function createStreamableUI() {
  let { ui, resolve, reject } = createSuspendedChunk();
  let currentValue: React.ReactNode = null;

  const streamable = {
    value: ui,
    append(value: React.ReactNode) {
      currentValue = value;

      const resolvable = createResolvablePromise();
      resolve({ value, done: false, append: true, next: resolvable.promise });
      resolve = resolvable.resolve;
      reject = resolvable.reject;

      return streamable;
    },
    update(value: React.ReactNode) {
      if (value === currentValue) {
        return streamable;
      }

      currentValue = value;

      const resolvable = createResolvablePromise();
      resolve({ value: currentValue, done: false, next: resolvable.promise });
      resolve = resolvable.resolve;
      reject = resolvable.reject;

      return streamable;
    },
    done() {
      resolve({ value: currentValue, done: true });
      return streamable;
    }
  };

  return streamable;
}

export async function someAction(prevState: any, formData: FormData) {
  const ui = createStreamableUI();

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: "You are helpful assistant."
        },
        {
          role: "user",
          content: "What is the weather in Poznan?"
        }
      ],
      tools: [
        {
          type: "function",
          function: {
            type: "function",
            name: "getWeather",
            parameters: {
              type: "object",
              properties: {
                location: {
                  type: "string",
                  description: "The location to get the weather for"
                }
              }
            }
          }
        }
      ],
      stream: true
    })
  });

  if (!response.body) {
    return;
  }

  void consumeStream(
    { readable: response.body, ui },
    {
      tools: {
        getWeather: generateWeatherComponent
      }
    }
  );

  return ui.value;
}

async function consumeStream(
  {
    readable,
    ui
  }: {
    readable: ReadableStream<Uint8Array>;
    ui: ReturnType<typeof createStreamableUI>;
  },
  {
    tools
  }: {
    tools: Record<
      string,
      (...args: any[]) => AsyncGenerator<JSX.Element, JSX.Element, unknown>
    >;
  }
) {
  const jsonReader = readable
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new AISanitizationStream())
    .pipeThrough(new AIJsonStream())
    .getReader();

  let functionName = "";
  let functionArgs = "";
  let startedFunctionCall = false;

  while (true) {
    const { done, value } = await jsonReader.read();
    if (done) {
      ui.done();
      break;
    }

    const { choices } = value;
    const choicesDelta = choices[0]?.delta;

    const content = choicesDelta.content;
    if (content) {
      ui.append(content);
    }

    const currentFunctionName = choicesDelta.tool_calls?.[0]?.function?.name;
    if (currentFunctionName) {
      startedFunctionCall = true;
      functionName = currentFunctionName;
    }

    const currentFunctionArguments =
      choicesDelta.tool_calls?.[0]?.function?.arguments;
    if (currentFunctionArguments) {
      functionArgs += currentFunctionArguments;
    }

    if (
      functionName &&
      !currentFunctionName &&
      !currentFunctionArguments &&
      startedFunctionCall
    ) {
      const currentFunctionName = functionName;
      const currentArgs = functionArgs;

      startedFunctionCall = false;
      functionName = "";
      functionArgs = "";

      const args = JSON.parse(currentArgs);
      const it = tools[currentFunctionName](args);

      while (true) {
        let { value, done } = await it.next();

        ui.update(value);

        if (done) {
          break;
        }
      }
    }
  }
}

class AISanitizationStream extends TransformStream<string, string> {
  constructor() {
    super({
      transform(chunk, controller) {
        const sanitizedChunk = chunk
          .trim()
          .replaceAll("data: ", "")
          .replaceAll("[DONE]", "")
          .trim();

        controller.enqueue(sanitizedChunk);
      },
      flush(controller) {
        controller.terminate();
      }
    });
  }
}

class AIJsonStream extends TransformStream<string, any> {
  constructor() {
    super({
      transform(chunk, controller) {
        const lines = chunk
          .split("\n")
          .filter((line) => line.length > 0)
          .map((line) => {
            try {
              return JSON.parse(line);
            } catch {
              return null;
            }
          });

        for (const line of lines) {
          controller.enqueue(line);
        }
      }
    });
  }
}
