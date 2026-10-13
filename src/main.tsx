import ReactDOM from "react-dom/client";
import "./shared/monacoLoader";
import App from "./App";
import { captureSsoReturn } from "./shared/ssoSignIn";
import { fetchUiTextOnce } from "./shared/docsWeb";
import "./index.css";

captureSsoReturn();

void fetchUiTextOnce();

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
