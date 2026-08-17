/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type {
  Category,
  Product,
  Project,
  Service,
  SiteSettings,
  Testimonial,
} from "./model";
import { settings as defaults } from "./model";
type Data = {
  categories: Category[];
  products: Product[];
  services: Service[];
  projects: Project[];
  testimonials: Testimonial[];
  settings: SiteSettings;
  loading: boolean;
  error: string;
};
const initial: Data = {
  categories: [],
  products: [],
  services: [],
  projects: [],
  testimonials: [],
  settings: defaults,
  loading: true,
  error: "",
};
const Context = createContext(initial);
export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState(initial);
  useEffect(() => {
    fetch("/api/public")
      .then((r) => r.json())
      .then((x) => {
        if (!x.success) throw new Error(x.message);
        setData({ ...x.data, loading: false, error: "" });
      })
      .catch(() =>
        setData((x) => ({
          ...x,
          loading: false,
          error: "Contenu temporairement indisponible.",
        })),
      );
  }, []);
  return <Context.Provider value={data}>{children}</Context.Provider>;
}
export const useBelgaData = () => useContext(Context);
