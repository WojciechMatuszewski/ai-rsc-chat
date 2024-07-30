# AI Chat RSC

WIP

## Running the app

- Create `.env.local` file and populate it with your OpenAI key.

  ```txt
  OPENAI_API_KEY=<your key here>
  ```

- Install dependencies

  ```bash
  pnpm install
  ```

- Run the app

  ```bash
  pnpm run dev
  ```

## Learnings

- You can return JSX from form [_server actions_](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations). Pretty neat!

  - Returning JSX from [_api routes_](https://nextjs.org/docs/pages/building-your-application/routing/api-routes) is probably also possible, but would require A LOT of work.

- It not possible to return a _stream_ from the _server actions_. The result has to be serializable.

- I've noticed that, when when I delay the OpenAI response and won't push a new update to the UI, Next.js closes the connection to the _server action_.

  - It seems like [the original implementation also has guards around that](https://github.com/vercel/ai/blob/130e05081dc5b45298e671cabfae3c9f8e552f5b/packages/core/rsc/streamable.tsx#L309).

- Looking at the many `@ai` packages created by Vercel, and their complexity, returning JSX from `tools` is very hard.

  - Working with text is easy, but as soon as you want to handle a _tool call_ yourself, you will need to parse the stream response, concatenate chunks and so on.

- The OpenAI sdk will automatically call tools for you, which we do not want. **An alternative route is to make the request to the API yourself**.

  - While making the request itself is not that hard, the parsing part is quite challenging.
