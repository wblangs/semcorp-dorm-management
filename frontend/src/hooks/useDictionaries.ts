import { useEffect, useState } from "react";

import { api } from "../api";
import { defaultDictionaries, DictionaryState, mergeDictionaries } from "../dictionaries";

export function useDictionaries() {
  const [dictionaries, setDictionaries] = useState<DictionaryState>(defaultDictionaries);

  useEffect(() => {
    const reload = () => {
      api
        .getDictionaries()
        .then((data) => setDictionaries(mergeDictionaries(data)))
        .catch(() => setDictionaries(defaultDictionaries));
    };
    reload();
    window.addEventListener("dictionaries:updated", reload);
    return () => {
      window.removeEventListener("dictionaries:updated", reload);
    };
  }, []);

  return dictionaries;
}
