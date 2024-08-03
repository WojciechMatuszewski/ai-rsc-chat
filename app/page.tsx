"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { someAction } from "@/lib/actions";
import { AnimatePresence, motion } from "framer-motion";
import { ElementRef, useOptimistic, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

export default function Home() {
  const [components, setComponents] = useState<React.ReactNode[]>([]);
  const [optimisticComponents, setOptimisticComponents] = useOptimistic(
    components,
    (components, newComponent: React.ReactNode) => {
      return [...components, newComponent];
    }
  );

  const formRef = useRef<ElementRef<"form">>(null);

  return (
    <div
      className={"max-w-lg w-full m-auto flex flex-col gap-[16px] mt-[16px]"}
    >
      <ul className={"flex flex-col gap-[16px]"}>
        <AnimatePresence mode={"sync"}>
          {optimisticComponents.map((component, index) => {
            return (
              <motion.li
                key={index}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {component}
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      <form
        ref={formRef}
        action={async (formData) => {
          const message = formData.get("message") as string;
          formRef.current?.reset();

          setOptimisticComponents(<span>Loading...</span>);

          const newComponent = await someAction({ message });
          setComponents((prev) => [...prev, newComponent]);
        }}
      >
        <fieldset className={"flex flex-col gap-[12px]"}>
          <Input name="message" />
          <FormButton />
        </fieldset>
      </form>
    </div>
  );
}

function FormButton() {
  const { pending } = useFormStatus();
  return (
    <Button className={"self-end"} disabled={pending}>
      Submit
    </Button>
  );
}
