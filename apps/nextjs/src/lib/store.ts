import { atom } from "jotai";

export namespace Settings {
  export const structName = atom("MyIcon");
  export const precision = atom(5);
  export const indentation = atom(4);
}
