---
name: widget-system
description: "Dashboard widget system guide for extensions using dashboard-spi. Use when adding widgets with WidgetContribution, data bindings (WidgetDataProvider, useMappedValue), datasource contributions, FlexModule wiring, and bindDashboardSpi."
user-invocable: true
---

# Dashboard widget system (`WidgetContribution` + data binding)

## ⚠️ CRITICAL RULE — Always register new widgets in `module-entry.ts`

**Every time a new widget contribution class is created, you MUST update `module-entry.ts` in the same task:**

1. Add an `import` for the new `*WidgetContribution` class.
2. Call `WidgetContribution.addContribution(bind, NewWidgetContribution);` in the `// widgets` section (alongside any existing registrations).
   Also ensure the flex module wires **platform** dashboard services when the host does not (typical in dev): import **`bindDashboardSpi`** from **`dashboard-spi/module-entry`** and call **`bindDashboardSpi(module)`** inside your **`FlexModule`** body (e.g. behind `import.meta.env.DEV`), **before** contribution bindings that depend on those services.
   Failing to register the contribution means the widget never appears in the palette. Do not finish a widget creation task without completing this step.

---

## Use this flow when the dashboard should expose a new **draggable widget type**: implement the React surface under **`src/widgets/`**, subclass **`WidgetContribution`** under **`src/contributions/`**, then register both **SPI** (if needed) and **your contribution** in **`module-entry.ts`**. Live data flows through **`WidgetDataProvider`** (the shell wraps rendered widgets); widget code reads bound values with **`useMappedData` / `useMappedValue`** keyed by **variable names**.

---

## Architecture (short)

1. **`WidgetContribution`** registers a **component factory** with **`widgetFactoryId`**, label, icon, grid hints (`minH`, `minW`), optional **`defaultDataMappings`** (applied when the widget is dropped), and optional **`configSchema`** for the property editor.
2. **`DashboardWidgetItem`** loads persisted widget content, wraps the factory output in **`WidgetDataProvider`**, and passes **`dataMappings`** from saved metadata.
3. **`IWidgetDataService`** resolves mappings against datasource instances, pushes updates via subscription, and supports refresh.

---

## Step 1 — Create the widget component

Build a component whose props match **`WidgetConfigMetadata<T>`**: your **`config`** shape is **`T`**; **`dataMappings`** and **`metadata`** are managed by the shell/store.

- Prefer **`useWidgetData()`** for loading / refresh / `hasData`.
- Read bound fields by **variable name** (must match contribution defaults and saved mappings):
  **Layout:** keep widget UI in **`src/widgets/<name>.widget.tsx`** (and shared presentational pieces alongside, e.g. **`src/widgets/stat-card.tsx`**).
  > **UI components**: Import primitives from **`@pjnube/flex-ui/*`** (e.g. `@pjnube/flex-ui/card`, `@pjnube/flex-ui/button`). See your host/FLEX docs for the full rule and sub-path reference.

```typescript
// Example: bindings named "number" and "timeseries" in defaultDataMappings
import type { WidgetConfigMetadata } from "dashboard-spi/spi";
import {
  useMappedData,
  useMappedValue,
  useWidgetData,
} from "dashboard-spi/spi";
import { Card, CardContent, CardHeader, CardTitle } from "@pjnube/flex-ui/card";
export const MyWidget = (props: WidgetConfigMetadata<MyConfig>) => {
  const { config } = props;
  const { loading, hasData } = useWidgetData();
  const rawValue = useMappedValue<unknown>("number", undefined);
  const trend = useMappedValue<unknown>("timeseries", undefined);
  // useMappedData gives DataBindingResult (includes error, loading hints per variable)
  const numberResult = useMappedData<number>("number", undefined);
  // ...render using config + bound data
};
```

- **`Component`** in the contribution must be a **`React.ElementType`** (component reference), not a pre-created element—same idea as status bar items.

---

## Step 2 — Subclass `WidgetContribution`

Add a class **`extends WidgetContribution<T>`**, mark it with **`@injectable()`** from **`@pjnube/flex-sdk`**, and implement:
| Member | Purpose |
|--------|---------|
| **`widgetFactoryId`** | Stable string id (e.g. `'stat-widget'`). Must be unique among widgets. |
| **`contributionDetails`** | `label`, **`Icon`** (Lucide or similar component), **`Component`**, **`metadata`** (grid + schema + defaults). |
| **`createWidgetConfig(...)`** | Merge persisted **`config`** with defaults so dropped/edited widgets always get a valid **`T`**. _(The SPI declares a second `componentFactory` argument; you may omit it in the implementation if unused.)_ |
**`metadata`** (typed via **`WidgetComponentFactoryMetadata`** from **`dashboard-spi/spi`**) commonly includes:

- **`minH` / `minW`** — grid constraints.
- **`defaultDataMappings`** — seeds per-variable specs (see **`DefaultDataMappingSpec`** on **`dashboard-spi/spi`**).
- **`configSchema`** — JSON schema for the property editor; use **`PropertyEditorSchema`** from **`@pjnube/flex-sdk`** where you need the type.
  **File layout:** **`src/contributions/<name>-widget.contribution.ts`**.
  Reference pattern (abbreviated):

```typescript
import {
  WidgetComponentFactoryMetadata,
  WidgetContribution,
} from "dashboard-spi/spi";
import { injectable } from "@pjnube/flex-sdk";
import { SomeLucideIcon } from "lucide-react";
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

## **`DefaultDataMappingSpec`** (from **`dashboard-spi/spi`**)

Fields: **`variableName`**, **`query`** (opaque to the widget; validated by the target datasource), optional **`datasourceId`**, **`refreshIntervalMs`**, **`description`**, **`maxCacheAgeMs`**, **`isEnabled`**. Omitting **`datasourceId`** typically resolves to the built-in mock datasource instance where the app seeds one.

## Mock datasource **`query.dataType`** (built-in **`MockDatasourceContribution`**)

For the mock datasource bundled with **dashboard-spi**, **`query.dataType`** supports:
| Value | Use for |
| ----- | ------- |
| **`"number"`** | Numeric metrics, counts, percentages, rates |
| **`"timeseries"`** | Time-ordered series for charts/sparklines |
Use whatever **`query`** shape your **registered datasource definition** documents in its **`querySchema`**; widgets stay datasource-agnostic and only depend on **`variableName`** → resolved payload.

```typescript
// ✅ Examples aligned with dashboard-spi mock + stat widget
query: {
  dataType: "number";
}
query: {
  dataType: "timeseries";
}
```

---

## Step 3 — Register in `FlexModule` ⚠️ REQUIRED — always do this last

> **This step is mandatory every time a new widget contribution is created. Without it the widget is invisible to the dashboard. Always edit `module-entry.ts` as the final step of any widget creation task.**

1. Import **`bindDashboardSpi`** from **`dashboard-spi/module-entry`** when your extension must register dashboard platform services (common in dev).
2. Import **`WidgetContribution`** and your **`MyWidgetContribution`** from **`dashboard-spi/spi`** and **`~/contributions/...`** respectively.
3. Inside **`FlexModule`**, call **`bindDashboardSpi(module)`** if required, then call **`WidgetContribution.addContribution(bind, MyWidgetContribution)`** in the **`// widgets`** section.

```typescript
// module-entry.ts
import { bindDashboardSpi } from "dashboard-spi/module-entry";
import { WidgetContribution } from "dashboard-spi/spi";
import { FlexModule } from "@pjnube/flex-sdk";
import { MyWidgetContribution } from "~/contributions/my-widget.contribution";
import { StatWidgetContribution } from "~/contributions/stat-widget.contribution";
export default FlexModule((module) => {
  const { bind } = module;
  if (import.meta.env.DEV) {
    bindDashboardSpi(module);
  }
  // widgets
  WidgetContribution.addContribution(bind, StatWidgetContribution);
  WidgetContribution.addContribution(bind, MyWidgetContribution);
});
```

**Never skip or defer widget registration.** After writing the contribution class, open **`module-entry.ts`**, add the import(s), and add **`WidgetContribution.addContribution`**.

## **`WidgetContribution.addContribution`** binds **`IComponentContribution`** and your class so **`initialize()`** runs and **`registerToFactory()`** registers the factory with the Flex **`ComponentFactoryRegistry`**.

---

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

1. **`DatasourceContribution`** — extend **`DatasourceContribution<TQuery, TConfig>`** from **`dashboard-spi/spi`**, implement **`definition`** (`DatasourceDefinition`), and call **`DatasourceContribution.addContribution(bind, YourContribution)`** in **`FlexModule`** (see **`MockDatasourceContribution`** on **`dashboard-spi/spi`**).
2. Register **`query`** shapes in that definition’s **`querySchema`** so bindings and mock/runtime implementations agree.
   Widgets stay datasource-agnostic: they only depend on **`variableName`** → resolved payload shape.

---

## Types and imports (this repo + **dashboard-spi**)

| What                                                                                                                                                                                                                 | Import from                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **`WidgetContribution`**, **`WidgetComponentFactoryMetadata`**, **`DefaultDataMappingSpec`**, **`DatasourceContribution`**, **`MockDatasourceContribution`**, **`WidgetDataProvider`**, **`DASHBOARD_SYMBOL`**, etc. | **`dashboard-spi/spi`**                        |
| **`WidgetConfigMetadata`**, **`WidgetConfig`**, **`DataMapping`**, **`IWidgetDataService`**, **`useMappedData`**, **`useMappedValue`**, **`useWidgetData`**, **`useFormattedValue`**                                 | **`dashboard-spi/spi`**                        |
| **`bindDashboardSpi`**                                                                                                                                                                                               | **`dashboard-spi/module-entry`**               |
| **`injectable`**, **`FlexModule`**, **`PropertyEditorSchema`** (when typing editor schema)                                                                                                                           | **`@pjnube/flex-sdk`**                         |
| Your **`StatWidget`**, **`MyWidget`**, contribution-specific props                                                                                                                                                   | **`~/widgets/...`**, **`~/contributions/...`** |

---

## Checklist

- [ ] **Step 1**: Widget component in **`src/widgets/`** accepts **`WidgetConfigMetadata<T>`** and uses **`useMappedValue` / `useMappedData` / `useWidgetData`** with consistent **variable names**. UI primitives from **`@pjnube/flex-ui/*`**.
- [ ] **Step 2**: **`MyWidgetContribution`** in **`src/contributions/`** with unique **`widgetFactoryId`**, **`contributionDetails`** (including **`defaultDataMappings`** if data-driven), and **`createWidgetConfig`**.
- [ ] **Step 3 ⚠️ REQUIRED**: Edit **`module-entry.ts`** — **`bindDashboardSpi(module)`** when needed; import **`MyWidgetContribution`**; call **`WidgetContribution.addContribution(bind, MyWidgetContribution)`** in **`// widgets`**.
- [ ] **Bindings**: **`defaultDataMappings`** **`variableName`** values match hooks; **`query`** matches the datasource definition you target (**mock** supports **`number`**, **`timeseries`**, **`json`** + **`statTrend`**, **`table`**).
- [ ] **Datasource**: If adding a new backend/mock type, **`DatasourceContribution`** registered and **`querySchema`** documents the **`query`** object.
