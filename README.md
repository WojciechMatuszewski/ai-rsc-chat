# AI Chat RSC

This small repo replicates some of the functionality of the [`ai/rsc`](https://sdk.vercel.ai/docs/ai-sdk-rsc/generative-ui-state) package.

It allows the user to prompt the AI for a weather. The AI will then try to call the `getWeather` function which **streams down a React component** to the client!

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

- There are _web streams_ and there are _node streams_.

  - The _node streams_ come from the `stream` package.

  - The _web streams_ are available globally.

  - **I do not see any _PassThrough_ streams in the _web streams_ specification**.

    - I guess one can create a _transform_ stream and not transform the data?

- Sometimes, and I'm unsure why its the case, the stuff I was adding to the `className` of components that I was generating did not apply.

  - It is as if the classes were completely ignored.

  - **I believe it was because they did not appear in the markup before hitting the `submit` button, as such Tailwind compiler did not "include" them into the stylesheet**.

- **It would be wonderful if I could pass components from the client into _server action_**.

  - That is not possible and I understand why. How would that even work? How do we serialize the internal state of the component?

  - It would be really neat to do that since I would not have to deal with _state_ when submitting the form

- It always gets me – **by default, any `setState` within the `action` prop will not propagate to the UI immediately, but only after the transition created by `action` ends**.

  - You can use `useFormState`, `useTransition` or `useOptimistic` to ensure the UI is "in-sync" when an action is pending.
