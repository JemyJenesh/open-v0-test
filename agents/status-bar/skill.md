---
name: status-bar
description: "Status Bar System guide for @pjnube/flex-sdk. Use when adding or updating status bar items with useStatusBar, StatusBarContribution, alignment, and priority."
user-invocable: true
---

# Status Bar System

## Overview

The Status Bar System provides a framework for managing and displaying status bar items in your extension. It allows you to define, register, and control the order of status bar items dynamically, enabling a customizable and user-friendly interface for displaying contextual information.

## Key Concepts

- **Node**: A React node displayed in the status bar.
- **Alignment**: Specifies whether the status bar item appears on the left or right side of the status bar.
- **Priority**: Controls the display order of status bar items; items with higher priority are shown before those with lower priority.

## Basic Usage

### 1. React Hook Approach

Use the `useStatusBar` hook in React components to register status bar items during run-time.

```typescript
// WorkspaceStatusBar.tsx
import {
  useStatusBar,
  StatusBarAlignment,
  HIGHEST_STATUSBAR_PRIORITY,
} from "@pjnube/flex-sdk";

export const Workspace = () => {
  const { registerStatusBarItem } = useStatusBar();

  useEffect(() => {
    const disposableStatusBar = registerStatusBarItem({
      alignment: StatusBarAlignment.right,
      priority: HIGHEST_STATUSBAR_PRIORITY,
      node: () => <span>status</span>,
    });

    return () => {
      disposableStatusBar.dispose();
    };
  }, []);
};
```

### 2. Class-based Approach

Extend `StatusBarContribution` to register status bar items during compile-time.

```typescript
import { injectable } from "@pjnube/flex-sdk";
import {
  HIGHEST_STATUSBAR_PRIORITY,
  StatusBarAlignment,
  StatusBarContribution,
} from "@pjnube/flex-sdk";
import { MyStatusBarItem1, MyStatusBarItem2 } from "./my-status-bar-item";

@injectable()
export class MyStatusBarContribution extends StatusBarContribution {
  statusBarItems = [
    {
      alignment: StatusBarAlignment.right,
      priority: HIGHEST_STATUSBAR_PRIORITY,
      node: MyStatusBarItem1,
    },
    {
      alignment: StatusBarAlignment.left,
      priority: HIGHEST_STATUSBAR_PRIORITY,
      node: MyStatusBarItem2,
    },
  ];
}
```

Register the contribution in your extension's `FlexModule`.

```typescript
import { FlexModule, StatusBarContribution } from "@pjnube/flex-sdk";

export default FlexModule((module) => {
  StatusBarContribution.addContribution(module, MyStatusBarContribution);
});
```

## Best Practices

### 1. Use Descriptive Nodes

Ensure that the nodes displayed in the status bar are meaningful and provide useful information to the user.

```typescript
const StatusBarNode = () => <div>Syncing...</div>;
```

### 2. Organize by Priority

Use priority values to control the order of status bar items. Higher priority items should appear first.

```typescript
this.statusBarRegistry.registerStatusBarItem({
  priority: 10,
  node: HighPriorityItem,
  alignment: StatusBarAlignment.right,
});

this.statusBarRegistry.registerStatusBarItem({
  priority: 1,
  node: LowPriorityItem,
  alignment: StatusBarAlignment.right,
});
```

### 3. Clean Up on Unmount

Ensure that status bar items are properly disposed of when the component is unmounted.

```typescript
useEffect(() => {
  const disposableStatusBar = registerStatusBarItem({
    priority: 5,
    node: YourNode,
  });

  return () => {
    disposableStatusBar.dispose();
  };
}, []);
```

## Summary

The Status Bar System provides a powerful and flexible way to manage status bar items in your extension by combining clear visual nodes, deterministic ordering through priority, and robust lifecycle cleanup.
