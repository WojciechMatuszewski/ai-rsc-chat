"use client";

import { someAction } from "@/lib/actions";
import { useFormState } from "react-dom";

export default function Home() {
  const [state, dispatch, pending] = useFormState(someAction, null);

  return (
    <div>
      {state ? state : null}
      <form action={dispatch}>
        <fieldset>
          <input name="color" />
          <button type="submit">Submit</button>
        </fieldset>
      </form>
    </div>
  );
}
