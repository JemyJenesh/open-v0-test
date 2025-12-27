/**
 * Open V0 Editor Integration Script
 * Add this to your project to enable visual editing
 */
(function() {
  if (window.parent === window) return; // Not in iframe

  let editMode = false;
  let elementIdCounter = 0;

  // Send context to parent
  function sendContext() {
    window.parent.postMessage({
      type: "demo-context",
      context: {
        route: window.location.pathname,
        scrollPosition: { x: window.scrollX, y: window.scrollY },
        viewport: { width: window.innerWidth, height: window.innerHeight }
      }
    }, "*");
  }

  // Get element's direct text content (not children)
  function getDirectTextContent(element) {
    let text = "";
    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      }
    }
    return text.trim();
  }

  // Handle element clicks
  function handleClick(e) {
    if (!editMode) return;

    const target = e.target;
    if (target.tagName === "A") return; // Allow links

    e.preventDefault();
    e.stopPropagation();

    // Generate element ID if needed
    if (!target.dataset.elementId) {
      target.dataset.elementId = `element-${++elementIdCounter}`;
    }

    const computedStyle = window.getComputedStyle(target);
    const rect = target.getBoundingClientRect();

    window.parent.postMessage({
      type: "element-click",
      element: {
        elementId: target.dataset.elementId,
        tagName: target.tagName,
        id: target.id,
        className: target.className,
        textContent: getDirectTextContent(target) || target.textContent?.substring(0, 100),
        rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
        computedStyle: {
          color: computedStyle.color,
          backgroundColor: computedStyle.backgroundColor,
          fontSize: computedStyle.fontSize,
          fontWeight: computedStyle.fontWeight,
          padding: computedStyle.padding,
          margin: computedStyle.margin,
          width: computedStyle.width,
          height: computedStyle.height,
          display: computedStyle.display,
          position: computedStyle.position
        }
      }
    }, "*");
  }

  // Listen for messages from parent
  window.addEventListener("message", (event) => {
    if (event.data.type === "set-mode") {
      editMode = event.data.mode === "edit";
      document.body.style.cursor = editMode ? "crosshair" : "";
    } else if (event.data.type === "update-properties") {
      const element = document.querySelector(`[data-element-id="${event.data.elementId}"]`);
      if (element) {
        const props = event.data.properties;
        if (props.color) element.style.color = props.color;
        if (props.backgroundColor) element.style.backgroundColor = props.backgroundColor;
        if (props.fontSize) element.style.fontSize = props.fontSize;
        if (props.width) element.style.width = props.width;
        if (props.height) element.style.height = props.height;
        if (props.padding) element.style.padding = props.padding;
        if (props.margin) element.style.margin = props.margin;
        if (props.textContent !== undefined) element.textContent = props.textContent;
      }
    }
  });

  // Setup listeners
  document.addEventListener("click", handleClick, true);
  window.addEventListener("scroll", sendContext);
  window.addEventListener("resize", sendContext);

  // Send initial context
  sendContext();

  // Watch for route changes (SPA support)
  let lastPath = window.location.pathname;
  setInterval(() => {
    if (window.location.pathname !== lastPath) {
      lastPath = window.location.pathname;
      sendContext();
    }
  }, 100);

  console.log("[Open V0] Editor integration loaded");
})();
