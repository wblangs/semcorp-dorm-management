import { useEffect, useState } from "react";

import { DictionaryState, loadDictionaries } from "../dictionaries";

export function useDictionaries() {
  const [dictionaries, setDictionaries] = useState<DictionaryState>(() => loadDictionaries());

  useEffect(() => {
    const reload = () => setDictionaries(loadDictionaries());
    window.addEventListener("storage", reload);
    window.addEventListener("dictionaries:updated", reload);
    return () => {
      window.removeEventListener("storage", reload);
      window.removeEventListener("dictionaries:updated", reload);
    };
  }, []);

  return dictionaries;
}
