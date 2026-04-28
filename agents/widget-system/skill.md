---
name: widget-system
description: "Dashboard widget system guide for v0-dashboard-poc. Use when adding widgets with WidgetContribution, data bindings (WidgetDataProvider, useMappedValue), datasource contributions, and FlexModule wiring."
user-invocable: true
---

# Dashboard widget system (`WidgetContribution` + data binding)

## ⚠️ CRITICAL RULE — Always register new widgets in `module-entry.ts`

**Every time a new widget contribution class is created, you MUST update `module-entry.ts` in the same task:**

1. Add an `import` for the new `*WidgetContribution` class.
2. Add `WidgetContribution.addContribution(bind, NewWidgetContribution);` in the `// widgets` section.

Failing to do this means the widget is never registered and will not appear in the dashboard. Do not finish a widget creation task without completing this step.

---

## Use this flow when the dashboard should expose a new **draggable widget type**: implement the React surface, declare metadata and optional **default data mappings** in a `WidgetContribution`, then register it in `FlexModule`. Live data flows through **`WidgetDataProvider`** (already wrapping rendered widgets on the dashboard); widget code reads bound values with **`useMappedData` / `useMappedValue`** keyed by **variable names**.

---

## Architecture (short)

1. **`WidgetContribution`** registers a **component factory** with `componentFactoryId`, label, icon, grid hints (`minH`, `minW`), optional **`defaultDataMappings`** (applied when the widget is dropped), and optional **`configSchema`** for the property editor.
2. **`DashboardWidgetItem`** loads persisted widget content, wraps the factory output in **`WidgetDataProvider`**, and passes **`dataMappings`** from saved metadata.
3. **`IWidgetDataService`** resolves mappings against datasource instances, pushes updates via subscription, and supports refresh.

---

## Step 1 — Create the widget component

Build a component whose props match **`WidgetConfigMetadata<T>`**: your **`config`** shape is `T`; **`dataMappings`** and **`metadata`** are managed by the shell/store.

- Prefer **`useWidgetData()`** for loading / refresh / `hasData`.
- Read bound fields by **variable name** (must match contribution defaults and saved mappings):

> **UI components**: Widget components live under `projects/` — always import UI primitives from `@pjnube/flex-ui/*` (see FLEX.md for the full rule and sub-path reference).

```typescript
// Example: two bindings named "number" and "trend" in defaultDataMappings
import {
  useMappedData,
  useMappedValue,
  useWidgetData,
} from "~/spi/data-binding";
import { Card, CardContent, CardHeader, CardTitle } from "@pjnube/flex-ui/card";

export const MyWidget = (props: WidgetConfigMetadata<MyConfig>) => {
  const { config } = props;
  const { loading, hasData } = useWidgetData();
  const rawValue = useMappedValue<unknown>("number", undefined);
  const trend = useMappedValue<unknown>("trend", undefined);
  // useMappedData gives DataBindingResult (includes error, loading hints per variable)
  const numberResult = useMappedData<number>("number", undefined);
  // ...render using config + bound data
};
```

- **`Component`** in the contribution must be an **`React.ElementType`** (component reference), not a pre-created element—same idea as status bar items.

---

## Step 2 — Subclass `WidgetContribution`

Add a class **`extends WidgetContribution<T>`**, mark it with **`@injectable()`**, and implement:
| Member | Purpose |
|--------|---------|
| **`widgetFactoryId`** | Stable string id (e.g. `'stat-widget'`). Must be unique among widgets. |
| **`contributionDetails`** | `label`, **`Icon`** (Lucide or similar component), **`Component`**, **`metadata`** (grid + schema + defaults). |
| **`createWidgetConfig(config?, factory)`** | Merge persisted **`config`** with defaults so dropped/edited widgets always get a valid **`T`**. |
**`metadata`** (typed via **`WidgetComponentFactoryMetadata`**) commonly includes:

- **`minH` / `minW`** — grid constraints.
- **`defaultDataMappings`** — seeds **`DataMapping`**-like specs per variable (see **Default mappings** below).
- **`configSchema`** — JSON schema for the property editor (**`PropertyEditorSchema`** from `@pjnube/flex-sdk`).
  Reference pattern (abbreviated):

```typescript
import { injectable } from "@pjnube/flex-sdk";
import {
  WidgetContribution,
  type WidgetComponentFactoryMetadata,
} from "~/contributions/widget-contribution";
import { MyWidget, type MyComponentProps } from "~/widgets/my.widget";
@injectable()
export class MyWidgetContribution extends WidgetContribution<MyComponentProps> {
  widgetFactoryId = "my-widget";
  contributionDetails = {
    label: { id: "My Widget" },
    Icon: SomeLucideIcon,
    metadata: {
      minH: 2,
      minW: 2,
      defaultDataMappings: [
        {
          variableName: "primaryMetric",
          query: { dataType: "number" },
          refreshIntervalMs: 5000,
        },
      ],
      configSchema: {
        type: "object",
        properties: {
          title: { type: "string", title: "Title", default: "Hello" },
        },
      },
    } satisfies WidgetComponentFactoryMetadata,
    Component: MyWidget,
  };
  createWidgetConfig(config?: MyComponentProps): MyComponentProps {
    return {
      title: config?.title ?? "Hello",
    };
  }
}
```

## **`DefaultDataMappingSpec`** fields (from **`widget-contribution.ts`**): `variableName`, `query`, optional `datasourceId`, `refreshIntervalMs`, `description`, `maxCacheAgeMs`, `isEnabled`. Omitting **`datasourceId`** typically resolves to the built-in mock datasource instance where the app seeds one.

## ⚠️ Supported `query.dataType` values

**Only two values are valid for `query.dataType` in `defaultDataMappings`:**

| Value          | Use for                                        |
| -------------- | ---------------------------------------------- |
| `"number"`     | Numeric metrics, counts, percentages, rates    |
| `"timeseries"` | Time-ordered series data for charts/sparklines |

**Do NOT use `"string"`, `"boolean"`, or any other type.** If a widget displays textual status (e.g. a traffic-light signal), map it through a `"number"` or `"timeseries"` binding and derive the display value inside the component.

```typescript
// ✅ Correct
query: {
  dataType: "number";
}
query: {
  dataType: "timeseries";
}

// ❌ Wrong — not supported
query: {
  dataType: "string";
}
query: {
  dataType: "boolean";
}
```

## Step 3 — Register in `FlexModule` ⚠️ REQUIRED — always do this last

> **This step is mandatory every time a new widget contribution is created. Without it the widget is invisible to the dashboard. Always edit `module-entry.ts` as the final step of any widget creation task.**

1. Add the import for the new contribution class at the top of `module-entry.ts`.
2. Call `WidgetContribution.addContribution(bind, MyWidgetContribution)` inside the `FlexModule` body, in the `// widgets` section.

```typescript
// module-entry.ts
import { WidgetContribution } from "~/contributions/widget-contribution";
import { MyWidgetContribution } from "~/contributions/widgets/my-widget.contribution";
export default FlexModule((module) => {
  const { bind } = module;
  // ... IDataBindingService, WidgetDataService, datasource registry, etc.

  // widgets
  WidgetContribution.addContribution(bind, StatWidgetContribution);
  WidgetContribution.addContribution(bind, MyWidgetContribution); // ← add new widget here
});
```

**Never skip or defer this step.** After writing the contribution class file, immediately open `module-entry.ts`, add the import, and add the `WidgetContribution.addContribution` line.

## **`WidgetContribution.addContribution`** binds **`IComponentContribution`** and your class so **`initialize()`** runs and **`registerToFactory()`** registers the factory with the Flex **`ComponentFactoryRegistry`**.

## Data binding setup

### How it connects at runtime

**`DashboardWidgetItem`** wraps **`render(widgetFactoryId, componentMetadata)`** with:

```typescript
<WidgetDataProvider widgetId={widget.id} dashboardId={dashboardId} dataMappings={dataMappings}>
  {render(widgetFactoryId, componentMetadata)}
</WidgetDataProvider>
```

So every dashboard widget instance receives **`WidgetDataProvider`** automatically; you do **not** add it inside the widget component.

### Mapping shape

Persisted **`dataMappings`** is **`Record<string, DataMapping>`**. Each **`DataMapping`** includes **`variableName`**, **`datasourceId`**, **`query`**, and timing fields (`refreshIntervalMs`, `maxCacheAgeMs`, …). The **`WidgetDataProvider`** pushes **`Object.values(dataMappings)`** into **`IWidgetDataService.updateWidgetConfiguration`**.

### Naming contract

- **`defaultDataMappings[].variableName`** (contribution) and editor-saved mappings must match the strings passed to **`useMappedValue('…')`** / **`useMappedData('…')`** in the widget.

### Refresh and loading

- **`useWidgetData().refresh()`** forces **`executeWidgetDataMappings`** (see service implementation for semantics).
- Subscription updates merge into **`MappedDataBindingResult`** keyed by variable name.

---

## Optional — New datasource types

If widgets need queries beyond what existing datasource definitions support:

1. **`DatasourceContribution`** — extend **`DatasourceContribution<TQuery, TConfig>`**, implement **`definition`** (`DatasourceDefinition`), and call **`DatasourceContribution.addContribution(bind, YourContribution)`** in **`FlexModule`** (see **`MockDatasourceContribution`**).
2. Register **`query` shapes** in that definition’s **`querySchema`** so bindings and mock/runtime implementations agree.
   Widgets stay datasource-agnostic: they only depend on **`variableName`** → resolved payload shape.

---

## Types and imports

- **`WidgetContribution`**, **`WidgetComponentFactoryMetadata`**, **`DefaultDataMappingSpec`**: `~/contributions/widget-contribution`.
- **`WidgetConfigMetadata`**, **`WidgetConfig`**: `~/spi/widget.types`.
- **`DataMapping`**, **`IWidgetDataService`**: `~/spi/data-binding` (types) / implementation wired via **`DASHBOARD_SYMBOL`** in **`module-entry`**.
- Flex SDK: **`@injectable()`**, **`inject`**, **`Provider`**, **`IComponentFactoryRegistry`**, **`SYMBOL.ComponentContribution`** — used by the base **`WidgetContribution`** implementation.

---

## Checklist

- [ ] **Step 1**: Widget component accepts **`WidgetConfigMetadata<T>`** and uses **`useMappedValue` / `useMappedData`** / **`useWidgetData`** with consistent **variable names**. All UI primitives imported from **`@pjnube/flex-ui/*`**.
- [ ] **Step 2**: **`MyWidgetContribution`** with unique **`widgetFactoryId`**, **`contributionDetails`** (including **`defaultDataMappings`** if data-driven), and **`createWidgetConfig`**.
- [ ] **Step 3 ⚠️ REQUIRED**: Edit `module-entry.ts` — add the import for `MyWidgetContribution` and call **`WidgetContribution.addContribution(bind, MyWidgetContribution)`** in the `// widgets` section. **This must always be done — never omit it.**
- [ ] **Bindings**: **`defaultDataMappings`** **`variableName`** values match hooks; **`query.dataType`** must be `"number"` or `"timeseries"` — no other values are supported; **`query`** matches the datasource definition you target.
- [ ] **Datasource**: If adding a new backend/mock type, **`DatasourceContribution`** registered and **`querySchema`** documents the **`query`** object.
