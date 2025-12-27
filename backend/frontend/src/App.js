import React, { useState } from "react";
import "./App.css";
import Footer from "./components/Footer";

function App() {
  const [count, setCount] = useState(0);

  const increase = () => {
    setCount(count + 1);
  };

  const decrease = () => {
    setCount(count - 1);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Open V0</h1>
        <div className="counter-section">
          <h2>Counter: {count}</h2>
          <div className="button-group">
            <button onClick={decrease} className="btn btn-secondary">
              Decrease
            </button>
            <button onClick={increase} className="btn btn-primary">
              Increase
            </button>
          </div>
        </div>
      </header>
      <Footer />
    </div>
  );
}

export default App;
