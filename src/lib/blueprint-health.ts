import { normalizeBlueprint } from "@/lib/module-schema";
import type { CustomModule, ModuleBlueprint, SmartPanel } from "@/lib/types";

export type BlueprintIssue = {
  code: string;
  severity: "error" | "warn";
  message: string;
};

export type BlueprintHealth = {
  ok: boolean;
  issues: BlueprintIssue[];
};

function fieldKeys(fields: { key: string }[] | undefined): Set<string> {
  return new Set((fields ?? []).map((f) => f.key).filter(Boolean));
}

/** Проверка чертежа / своего дневника — без «тихого» проглатывания дыр */
export function validateBlueprint(
  bp: Partial<ModuleBlueprint> | null | undefined,
): BlueprintHealth {
  const issues: BlueprintIssue[] = [];
  if (!bp || typeof bp !== "object") {
    return {
      ok: false,
      issues: [{ code: "empty", severity: "error", message: "Нет чертежа дневника" }],
    };
  }

  if (!String(bp.title || "").trim()) {
    issues.push({
      code: "no_title",
      severity: "error",
      message: "Нет названия дневника",
    });
  }

  const fields = Array.isArray(bp.fields) ? bp.fields : [];
  if (fields.length === 0) {
    issues.push({
      code: "no_fields",
      severity: "error",
      message: "Нет полей для записи",
    });
  }

  const keys = fieldKeys(fields);
  const seen = new Set<string>();
  for (const f of fields) {
    const k = String(f?.key || "");
    if (!k) {
      issues.push({
        code: "empty_key",
        severity: "error",
        message: `Поле «${f?.label || "?"}» без ключа`,
      });
      continue;
    }
    if (seen.has(k)) {
      issues.push({
        code: "dup_key",
        severity: "error",
        message: `Дубль ключа поля: ${k}`,
      });
    }
    seen.add(k);
    if (f.type === "select" && (!f.options || f.options.length === 0)) {
      issues.push({
        code: "select_opts",
        severity: "warn",
        message: `Список «${f.label}» без вариантов`,
      });
    }
  }

  if (bp.chartFieldKey && !keys.has(bp.chartFieldKey)) {
    issues.push({
      code: "bad_chart",
      severity: "warn",
      message: `График ссылается на неизвестное поле «${bp.chartFieldKey}»`,
    });
  }

  const smart = bp.smart as SmartPanel | undefined;
  if (!smart) {
    issues.push({
      code: "no_smart",
      severity: "warn",
      message: "Нет умного виджета — будет подставлен шаблон",
    });
  } else {
    issues.push(...validateSmart(smart, keys));
  }

  return {
    ok: !issues.some((i) => i.severity === "error"),
    issues,
  };
}

function validateSmart(smart: SmartPanel, keys: Set<string>): BlueprintIssue[] {
  const issues: BlueprintIssue[] = [];
  if (!smart.title?.trim()) {
    issues.push({
      code: "smart_title",
      severity: "warn",
      message: "У виджета нет заголовка",
    });
  }

  switch (smart.kind) {
    case "milestones":
      if (!smart.milestones?.length) {
        issues.push({
          code: "empty_milestones",
          severity: "error",
          message: "Виджет вех без пунктов",
        });
      }
      break;
    case "goal":
      if (!smart.goalTarget || smart.goalTarget <= 0) {
        issues.push({
          code: "bad_goal",
          severity: "warn",
          message: "Цель без нормального числа",
        });
      }
      if (smart.goalFieldKey && !keys.has(smart.goalFieldKey)) {
        issues.push({
          code: "bad_goal_field",
          severity: "warn",
          message: `Цель ссылается на поле «${smart.goalFieldKey}», которого нет`,
        });
      }
      break;
    case "scale":
      if (smart.scaleFieldKey && !keys.has(smart.scaleFieldKey)) {
        issues.push({
          code: "bad_scale_field",
          severity: "warn",
          message: `Шкала ссылается на поле «${smart.scaleFieldKey}», которого нет`,
        });
      }
      break;
    case "timer":
      if (!keys.has("minutes") && !keys.has("mins") && !keys.has("duration")) {
        issues.push({
          code: "timer_no_minutes",
          severity: "warn",
          message: "Таймер без числового поля минут",
        });
      }
      break;
    case "streak":
    case "tips":
      break;
    default:
      issues.push({
        code: "unknown_smart",
        severity: "error",
        message: `Неизвестный виджет: ${String((smart as SmartPanel).kind)}`,
      });
  }
  return issues;
}

export function validateCustomModule(mod: CustomModule): BlueprintHealth {
  return validateBlueprint({
    title: mod.title,
    description: mod.description,
    icon: mod.icon,
    fields: mod.fields ?? [],
    chartFieldKey: mod.chartFieldKey,
    smart: mod.smart,
  });
}

/** Локальная починка через normalize — без вызова ИИ */
export function repairBlueprintLocally(mod: CustomModule): ModuleBlueprint {
  return normalizeBlueprint(
    {
      title: mod.title,
      description: mod.description,
      icon: mod.icon,
      fields: mod.fields ?? [],
      chartFieldKey: mod.chartFieldKey,
      smart: mod.smart,
    },
    `${mod.title} ${mod.description}`,
  );
}

export function needsAiRepair(health: BlueprintHealth): boolean {
  return health.issues.some(
    (i) =>
      i.severity === "error" &&
      (i.code === "empty_milestones" ||
        i.code === "unknown_smart" ||
        i.code === "empty" ||
        i.code === "no_fields"),
  );
}
