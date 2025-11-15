import { useState } from "react";

const DemoApp = () => {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Demo React App
          </h1>
          <p className="text-xl text-gray-600">
            This is a sample app to test the visual editor
          </p>
        </header>

        {/* Counter Section */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <h2 className="text-3xl font-semibold text-gray-800 mb-4">
            Interactive Counter
          </h2>
          <div className="flex items-center gap-6">
            <button
              onClick={() => setCount(count - 1)}
              className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
            >
              Decrease
            </button>
            <div className="text-6xl font-bold text-indigo-600 min-w-[120px] text-center">
              {count}
            </div>
            <button
              onClick={() => setCount(count + 1)}
              className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
            >
              Increase
            </button>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="w-12 h-12 bg-blue-500 rounded-lg mb-4 flex items-center justify-center">
              <span className="text-white text-2xl">🎨</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Design</h3>
            <p className="text-gray-600">
              Beautiful and responsive UI components
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="w-12 h-12 bg-purple-500 rounded-lg mb-4 flex items-center justify-center">
              <span className="text-white text-2xl">⚡</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Fast</h3>
            <p className="text-gray-600">
              Lightning-fast performance and interactions
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="w-12 h-12 bg-green-500 rounded-lg mb-4 flex items-center justify-center">
              <span className="text-white text-2xl">🚀</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Modern</h3>
            <p className="text-gray-600">
              Built with the latest React technologies
            </p>
          </div>
        </div>

        {/* Text Section */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-3xl font-semibold text-gray-800 mb-4">
            About This Demo
          </h2>
          <p className="text-gray-600 text-lg leading-relaxed mb-4">
            This demo app showcases various UI elements that can be selected and edited
            using the visual editor. Try clicking on different elements to see the
            properties panel update.
          </p>
          <p className="text-gray-600 text-lg leading-relaxed">
            The visual editor allows you to modify text content, styles, and add
            comments to specific elements without directly editing code.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DemoApp;
