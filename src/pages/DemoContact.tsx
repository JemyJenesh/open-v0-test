import { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";

const DemoContact = () => {
  const location = useLocation();
  const [mode, setMode] = useState<"preview" | "edit">("edit");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });

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
      
      if (mode === "edit" && window.parent !== window) {
        e.preventDefault();
        e.stopPropagation();
        
        // Generate unique ID for element only if it doesn't have one
        let elementId = target.getAttribute('data-element-id');
        if (!elementId) {
          elementId = `${target.tagName.toLowerCase()}_${Date.now()}`;
          target.setAttribute('data-element-id', elementId);
        }
        
        // Get computed styles
        const styles = window.getComputedStyle(target);
        
        // Get direct text content only (not including children)
        let directText = "";
        for (let node of Array.from(target.childNodes)) {
          if (node.nodeType === Node.TEXT_NODE) {
            directText += node.textContent;
          }
        }
        directText = directText.trim();
        
        window.parent.postMessage({
          type: "element-click",
          element: {
            elementId,
            tagName: target.tagName,
            id: target.id,
            className: target.className,
            textContent: directText || (target.children.length > 0 ? `[${target.children.length} children]` : ""),
            styles: {
              color: styles.color,
              backgroundColor: styles.backgroundColor,
              fontSize: styles.fontSize,
              width: styles.width,
              height: styles.height,
              padding: styles.padding,
              margin: styles.margin,
            }
          }
        }, "*");
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [mode]);

  // Listen for property updates and mode changes from parent
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "update-properties") {
        const element = document.querySelector(`[data-element-id="${event.data.elementId}"]`) as HTMLElement;
        if (element && event.data.properties) {
          const props = event.data.properties;
          // Only update text content if it's not a placeholder for children
          if (props.textContent && !props.textContent.startsWith('[')) {
            element.textContent = props.textContent;
          }
          if (props.color) element.style.color = props.color;
          if (props.backgroundColor) element.style.backgroundColor = props.backgroundColor;
          if (props.fontSize) element.style.fontSize = props.fontSize;
          if (props.width) element.style.width = props.width;
          if (props.height) element.style.height = props.height;
          if (props.padding) element.style.padding = props.padding;
          if (props.margin) element.style.margin = props.margin;
        }
      } else if (event.data.type === "set-mode") {
        setMode(event.data.mode);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`Message sent!\nName: ${formData.name}\nEmail: ${formData.email}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-100 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Navigation */}
        <nav className="mb-8 flex gap-4">
          <Link to="/demo-app" className="px-4 py-2 bg-white rounded-lg shadow hover:shadow-md transition-shadow">
            Home
          </Link>
          <Link to="/demo-app/about" className="px-4 py-2 bg-white rounded-lg shadow hover:shadow-md transition-shadow">
            About
          </Link>
          <Link to="/demo-app/contact" className="px-4 py-2 bg-orange-600 text-white rounded-lg shadow hover:shadow-md transition-shadow">
            Contact
          </Link>
        </nav>

        {/* Header */}
        <header className="mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Contact Us
          </h1>
          <p className="text-xl text-gray-600">
            Get in touch with our team
          </p>
        </header>

        {/* Contact Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <h2 className="text-3xl font-semibold text-gray-800 mb-6">
            Send us a message
          </h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Your Name
              </label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="John Doe"
                required
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="john@example.com"
                required
              />
            </div>
            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                Message
              </label>
              <textarea
                id="message"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                rows={5}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                placeholder="Tell us what you think..."
                required
              />
            </div>
            <button
              type="submit"
              className="w-full px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium text-lg"
            >
              Send Message
            </button>
          </form>
        </div>

        {/* Contact Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="w-12 h-12 bg-orange-500 rounded-lg mb-4 flex items-center justify-center">
              <span className="text-white text-2xl">📧</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Email</h3>
            <p className="text-gray-600">contact@example.com</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="w-12 h-12 bg-red-500 rounded-lg mb-4 flex items-center justify-center">
              <span className="text-white text-2xl">📱</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Phone</h3>
            <p className="text-gray-600">+1 (555) 123-4567</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="w-12 h-12 bg-yellow-500 rounded-lg mb-4 flex items-center justify-center">
              <span className="text-white text-2xl">📍</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Office</h3>
            <p className="text-gray-600">123 Demo Street, Tech City</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DemoContact;
