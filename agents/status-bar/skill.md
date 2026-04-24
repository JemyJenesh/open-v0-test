---
name: status-bar
description: "Status Bar System guide for @pjnube/flex-sdk. Use when adding or updating status bar items with useStatusBar, StatusBarContribution, alignment, and priority."
user-invocable: true
---

# Status bar with `StatusBarContribution` (@pjnube/flex-sdk)

## Use this flow when a Flex extension should add one or more **fixed** status bar items: build the UI as normal React components, register them in a `StatusBarContribution`, then wire that contribution in `FlexModule`.

## Step 1 — Create a status bar component

Build a small presentational component (or several) for what appears in the bar. It is a `React.ElementType`—a function or class component, not a pre-rendered element.

```typescript
// my-status-indicator.tsx
export function MyStatusIndicator() {
  return <span className="text-caption">Ready</span>;
}
```

## Keep labels short; the bar is a single line with limited space.

## Step 2 — Register components in a `StatusBarContribution`

Add a class that **extends** `StatusBarContribution`, mark it with `@injectable()`, and set **`statusBarItems`**: an array of `{ alignment, priority?, node, acl? }`. Do not set `id` yourself—the base class assigns it when the contribution runs.

```typescript
// my-status-bar-contribution.ts
import { injectable } from "@pjnube/flex-sdk";
import {
  HIGHEST_STATUSBAR_PRIORITY,
  StatusBarAlignment,
  StatusBarContribution,
} from "@pjnube/flex-sdk";
import { MyStatusIndicator } from "./my-status-indicator";
@injectable()
export class MyStatusBarContribution extends StatusBarContribution {
  statusBarItems = [
    {
      alignment: StatusBarAlignment.right,
      priority: HIGHEST_STATUSBAR_PRIORITY,
      node: MyStatusIndicator,
    },
  ];
}
```

- **`alignment`**: `StatusBarAlignment.left` or `StatusBarAlignment.right`.
- **`priority`**: optional number; see **Priority (left vs right)** below. `HIGHEST_STATUSBAR_PRIORITY` (`1000`) is exported for “stick to the important edge” use cases—still interpret it per side.
- **`acl`**: optional; if set, the item is gated by the same access rules as elsewhere (`CanAccess`).

---

## Step 3 — Add the contribution to your `FlexModule`

In your extension’s module entry, register the class so the shell instantiates it and calls `initialize()` with everything else.

```typescript
import { FlexModule, StatusBarContribution } from "@pjnube/flex-sdk";
import { MyStatusBarContribution } from "./my-status-bar-contribution";
export default FlexModule((module) => {
  StatusBarContribution.addContribution(module, MyStatusBarContribution);
});
```

## `addContribution` binds the class in the container and associates it with the current `FlexModule` extension.

## Priority (left vs right)

The host sorts **left** and **right** groups **differently**, so the same number does not mean the same visual order on both sides.

- **Left**: higher `priority` values appear **earlier** in the left cluster (descending).
- **Right**: **lower** `priority` values appear **earlier** in the right cluster (ascending, toward the inner side of the bar).
  Missing `priority` is treated as `0`. Ties keep **registration** order within that side.

---

## Types and the SDK

## Imports come only from **`@pjnube/flex-sdk`**. Use “Go to type definition” on `StatusBarItem`, `StatusBarContribution`, and `StatusBarAlignment` in your extension to confirm fields.

## Alternative: `useStatusBar` (runtime, no contribution class)

For items that should **follow a component’s mount/unmount** (e.g. one screen), use the **`useStatusBar`** hook, call **`registerStatusBarItem`** in an effect, and **`dispose()`** the return value in the effect cleanup. The hook is typed so you do **not** pass `id`; the shell renders the `node` directly. Prefer **Step 1–3** when items belong to the whole extension, not a single tree.

```typescript
import { useEffect } from "react";
import {
  useStatusBar,
  StatusBarAlignment,
  HIGHEST_STATUSBAR_PRIORITY,
} from "@pjnube/flex-sdk";
const { registerStatusBarItem } = useStatusBar();
useEffect(() => {
  const d = registerStatusBarItem({
    alignment: StatusBarAlignment.right,
    priority: HIGHEST_STATUSBAR_PRIORITY,
    node: MyStatusIndicator,
  });
  return () => d.dispose();
}, [registerStatusBarItem]);
```

---

## Checklist

- [ ] **Step 1**: Status bar component(s) defined as `React.ElementType`.
- [ ] **Step 2**: `MyStatusBarContribution` with `statusBarItems` and `@injectable()`.
- [ ] **Step 3**: `StatusBarContribution.addContribution(module, MyStatusBarContribution)` in `FlexModule`.
- [ ] Priorities chosen with **left vs right** sort rules in mind; `acl` if needed.
- [ ] If using `useStatusBar` instead, every registration has a matching `dispose`.
