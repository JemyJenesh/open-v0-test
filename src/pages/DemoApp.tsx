import { useState, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";

const DemoApp = () => {
  const [count, setCount] = useState(0);
  const [mode, setMode] = useState<"preview" | "edit">("edit");
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
      
      if (mode === "edit") {
        // Don't prevent default for links to allow navigation
        const isLink = target.tagName === 'A' || target.closest('a');
        if (!isLink) {
          e.preventDefault();
          e.stopPropagation();
        } else {
          return; // Let links work normally
        }
        
        // Generate unique ID for element only if it doesn't have one
        let elementId = target.getAttribute('data-element-id');
        if (!elementId) {
          elementId = `${target.tagName.toLowerCase()}_${Date.now()}`;
          target.setAttribute('data-element-id', elementId);
        }
        
        // Get computed styles
        const styles = window.getComputedStyle(target);
        
        // Analyze all elements of the same type on the page
        const sameTypeElements = document.querySelectorAll(target.tagName.toLowerCase());
        const commonValues: Record<string, Set<string>> = {
          fontSize: new Set(),
          color: new Set(),
          backgroundColor: new Set(),
          padding: new Set(),
          margin: new Set(),
        };
        
        sameTypeElements.forEach((el) => {
          const elStyles = window.getComputedStyle(el as HTMLElement);
          commonValues.fontSize.add(elStyles.fontSize);
          commonValues.color.add(elStyles.color);
          commonValues.backgroundColor.add(elStyles.backgroundColor);
          commonValues.padding.add(elStyles.padding);
          commonValues.margin.add(elStyles.margin);
        });
        
        // Convert sets to arrays and limit to top 5 values
        const commonValuesObj: Record<string, string[]> = {};
        Object.keys(commonValues).forEach(key => {
          commonValuesObj[key] = Array.from(commonValues[key]).slice(0, 5);
        });
        
        // Get direct text content only (not including children)
        let directText = "";
        for (let node of Array.from(target.childNodes)) {
          if (node.nodeType === Node.TEXT_NODE) {
            directText += node.textContent;
          }
        }
        directText = directText.trim();
        
        if (window.parent !== window) {
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
              },
              commonValues: commonValuesObj,
            }
          }, "*");
        }
      }
      // In preview mode, let clicks behave normally
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
          // Only update text content if element has no children and it's not a placeholder
          if (props.textContent && !props.textContent.startsWith('[') && element.children.length === 0) {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Navigation */}
        <nav className="mb-8 flex gap-4">
          <Link to="/demo-app" className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow hover:shadow-md transition-shadow">
            Home
          </Link>
          <Link to="/demo-app/about" className="px-4 py-2 bg-white rounded-lg shadow hover:shadow-md transition-shadow">
            About
          </Link>
          <Link to="/demo-app/contact" className="px-4 py-2 bg-white rounded-lg shadow hover:shadow-md transition-shadow">
            Contact
          </Link>
        </nav>

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
