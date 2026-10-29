import { Link } from "react-router-dom";
import OshiQuiz from "../components/OshiQuiz.jsx";
import "../styles/oshi-match.css";

export default function OshiMatch() {
  return (
    <div className="om-page">
      <header className="om-header">
        <div className="om-header-top">
          <Link to="/" className="om-back">
            ← 聊天
          </Link>
          <h1 className="om-heading">推し配對分析</h1>
        </div>
        <p className="om-tagline">LUMINA 5 題測驗 · Eva 幫你出推し認證書 ✨</p>
      </header>

      <OshiQuiz />
    </div>
  );
}
