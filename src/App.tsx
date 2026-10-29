import { useEffect, useState } from "react";
import { HostConsole } from "./host/HostConsole";
import { Stage } from "./stage/Stage";

const route = () => (location.hash.startsWith("#/stage") ? "stage" : "host");

export function App() {
  const [page, setPage] = useState(route);
  useEffect(() => {
    const onHash = () => setPage(route());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    document.title = page === "stage" ? "Moltiboso Money — Stage" : "Moltiboso Money — Host Console";
  }, [page]);
  return page === "stage" ? <Stage /> : <HostConsole />;
}
