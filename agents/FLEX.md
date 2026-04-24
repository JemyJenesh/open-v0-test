---
name: react-skill
description: "React component authoring rules for this workspace. Use when creating or editing React UI files, components, pages, or hooks so components are written in .tsx instead of .jsx or .ts."
user-invocable: true
---

# React Skill

## Overview

This skill defines React file conventions for this workspace.

## Core Rule

- Always create React components as `.tsx` files.
- Do not create new React component files with `.jsx` or `.ts`.
- If a new component currently exists as `.jsx`, migrate it to `.tsx`.

## When to Use

- Creating a new React component.
- Scaffolding a new page or reusable UI module.
- Refactoring component code into new files.

## Required Behavior

1. For every new React component, choose a file name ending in `.tsx`.
2. Keep non-React utility files in `.ts`.
3. If a user request is ambiguous, assume React UI components should be `.tsx`.
4. Preserve existing import paths and update extensions only where needed.

## Examples

- Correct: `src/components/UserCard.tsx`
- Correct: `src/pages/Settings.tsx`
- Avoid: `src/components/UserCard.jsx`
- Avoid: `src/components/UserCard.ts`

## Migration Guidance

When converting a component from `.jsx` to `.tsx`:

1. Rename the file to `.tsx`.
2. Add prop and state types incrementally.
3. Resolve TypeScript errors introduced by strict typing.
4. Keep behavior unchanged while typing the component.

## Summary

Use `.tsx` as the default and required format for all new React component files in this project.
