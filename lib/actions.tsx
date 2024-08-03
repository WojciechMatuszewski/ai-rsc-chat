"use server";

import { Suspense } from "react";
import { setTimeout } from "timers/promises";
import { Stream } from "openai/streaming";

const getWeather = async () => {
  await setTimeout(2_000);
  return "20 degree celsius";
};

async function* generateWeatherComponent({ location }: { location: string }) {
  yield <span>Loading...</span>;

  const weather = await getWeather();

  return (
    <div className={"w-full border p-5"}>
      <p>
        Weather in {location} is {weather}
      </p>
      <p>
        You asked for weather in location:{" "}
        <span className={"font-bold"}>{location}</span>
      </p>
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
    ) as React.ReactNode,
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

export async function someAction({ message }: { message: string }) {
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
          content: message
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
                  description: "Gets weather for a given location."
                }
              }
            }
          }
        }
      ],
      stream: true
    })
  });

  const stream = Stream.fromSSEResponse(response, new AbortController())
    .toReadableStream()
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new JsonStream());

  void consumeStream(
    { stream, ui },
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
    stream,
    ui
  }: {
    stream: ReadableStream<any>;
    ui: ReturnType<typeof createStreamableUI>;
  },
  {
    tools
  }: {
    tools: Record<
      string,
      (
        ...args: any[]
      ) => AsyncGenerator<React.ReactNode, React.ReactNode, unknown>
    >;
  }
) {
  const reader = stream.getReader();

  let functionName = "";
  let functionArgs = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      ui.done();
      break;
    }

    if (!value) {
      continue;
    }

    const choices = value.choices;
    const content = choices[0]?.delta?.content;

    if (content != null) {
      ui.append(content);
    }

    const currentFunctionName =
      choices[0]?.delta?.tool_calls?.[0]?.function?.name;
    if (currentFunctionName) {
      functionName = currentFunctionName;
    }

    const currentFunctionArguments =
      choices[0]?.delta?.tool_calls?.[0]?.function?.arguments;
    if (currentFunctionArguments) {
      functionArgs += currentFunctionArguments;
    }

    const hasFunctionToCall =
      functionName != "" &&
      currentFunctionName == null &&
      currentFunctionArguments == null;

    if (!hasFunctionToCall) {
      continue;
    }

    const args = JSON.parse(functionArgs);
    const it = tools[functionName](args);

    functionName = "";
    functionArgs = "";

    while (true) {
      let { value, done } = await it.next();

      ui.update(value);

      if (done) {
        break;
      }
    }
  }
}

class JsonStream extends TransformStream<string, any> {
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
