import { useEffect } from "react";
import { useLocation, Link } from "react-router-dom";

const DemoAbout = () => {
  const location = useLocation();

  // Send context updates to parent window
  useEffect(() => {
    const sendContext = () => {
      if (window.parent !== window) {
        window.parent.postMessage({
          type: "demo-context",
          context: {
            route: location.pathname,
            scrollPosition: { x: window.scrollX, y: window.scrollY },
            viewport: { width: window.innerWidth, height: window.innerHeight },
          }
        }, "*");
      }
    };

    sendContext();
    window.addEventListener("scroll", sendContext);
    window.addEventListener("resize", sendContext);

    return () => {
      window.removeEventListener("scroll", sendContext);
      window.removeEventListener("resize", sendContext);
    };
  }, [location.pathname]);

  // Handle element clicks
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (window.parent !== window) {
        window.parent.postMessage({
          type: "element-click",
          element: {
            tagName: target.tagName,
            id: target.id,
            className: target.className,
            textContent: target.textContent?.substring(0, 100),
          }
        }, "*");
      }
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-teal-100 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Navigation */}
        <nav className="mb-8 flex gap-4">
          <Link to="/demo-app" className="px-4 py-2 bg-white rounded-lg shadow hover:shadow-md transition-shadow">
            Home
          </Link>
          <Link to="/demo-app/about" className="px-4 py-2 bg-teal-600 text-white rounded-lg shadow hover:shadow-md transition-shadow">
            About
          </Link>
          <Link to="/demo-app/contact" className="px-4 py-2 bg-white rounded-lg shadow hover:shadow-md transition-shadow">
            Contact
          </Link>
        </nav>

        {/* Header */}
        <header className="mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            About Us
          </h1>
          <p className="text-xl text-gray-600">
            Learn more about our visual editor
          </p>
        </header>

        {/* Mission Section */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <h2 className="text-3xl font-semibold text-gray-800 mb-4">
            Our Mission
          </h2>
          <p className="text-gray-600 text-lg leading-relaxed mb-4">
            We're building a revolutionary visual editor that makes React development
            accessible to everyone. Our goal is to bridge the gap between design and
            code, allowing developers to work more efficiently.
          </p>
          <p className="text-gray-600 text-lg leading-relaxed">
            With our editor, you can visually select elements, modify properties, and
            see changes in real-time without leaving your workflow.
          </p>
        </div>

        {/* Team Section */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <h2 className="text-3xl font-semibold text-gray-800 mb-6">
            Our Team
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
              <div className="w-16 h-16 bg-teal-500 rounded-full flex items-center justify-center text-white text-2xl">
                👨‍💻
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-800">John Developer</h3>
                <p className="text-gray-600">Lead Engineer</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-white text-2xl">
                👩‍🎨
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-800">Jane Designer</h3>
                <p className="text-gray-600">UI/UX Lead</p>
              </div>
            </div>
          </div>
        </div>

        {/* Features List */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-3xl font-semibold text-gray-800 mb-6">
            Key Features
          </h2>
          <ul className="space-y-4">
            <li className="flex items-start gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <h3 className="font-semibold text-gray-800 text-lg">Visual Element Selection</h3>
                <p className="text-gray-600">Click on any element to edit its properties</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <h3 className="font-semibold text-gray-800 text-lg">AI-Powered Chat</h3>
                <p className="text-gray-600">Get help building your app with AI assistance</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <h3 className="font-semibold text-gray-800 text-lg">Live Preview</h3>
                <p className="text-gray-600">See changes instantly in the preview panel</p>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default DemoAbout;
