"use client";

import { useEffect, useState } from "react";
import { Plus, Copy, RotateCcw, Save, Trash2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import {
  cloneDefaultRules,
  loadFraudRules,
  newRuleId,
  saveFraudRules,
  serializeEnabledRules,
  type FraudRule,
} from "@/lib/fraud-rules";

/**
 * Fraud Detection Rules editor modal.
 *
 * Faithful rebuild of the standalone HTML's rule editor: editable, localStorage-
 * persisted rules (toggle / edit / add / delete / copy-all / reset / save),
 * with a live active-count badge. Survives page refresh via the shared
 * fraud-rules lib (same localStorage key as the original page).
 */
export function FraudDetectionRulesModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [rules, setRules] = useState<FraudRule[]>([]);
  const [savedFlash, setSavedFlash] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load persisted rules each time the modal opens (picks up prior saves).
  useEffect(() => {
    if (open) setRules(loadFraudRules());
  }, [open]);

  const enabledCount = rules.filter((r) => r.enabled).length;

  function toggleRule(idx: number) {
    setRules((rs) =>
      rs.map((r, i) => (i === idx ? { ...r, enabled: !r.enabled } : r))
    );
  }

  function editTitle(idx: number, title: string) {
    setRules((rs) => rs.map((r, i) => (i === idx ? { ...r, title } : r)));
  }

  function editBody(idx: number, body: string) {
    setRules((rs) => rs.map((r, i) => (i === idx ? { ...r, body } : r)));
  }

  function deleteRule(idx: number) {
    const rule = rules[idx];
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Delete rule "${rule.title}"?`)
    )
      return;
    setRules((rs) => rs.filter((_, i) => i !== idx));
  }

  function addRule() {
    setRules((rs) => [
      ...rs,
      {
        id: newRuleId(),
        title: "New Rule",
        enabled: true,
        body: "# Describe your rule\nIF  \nTHEN ",
      },
    ]);
  }

  function copyAll() {
    const text = serializeEnabledRules(rules);
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      });
    }
  }

  function resetDefaults() {
    if (
      typeof window !== "undefined" &&
      !window.confirm("Reset all rules to defaults? Your custom rules will be lost.")
    )
      return;
    const defaults = cloneDefaultRules();
    setRules(defaults);
    saveFraudRules(defaults);
  }

  function saveAll() {
    saveFraudRules(rules);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Fraud Detection Rules"
      className="max-w-4xl"
    >
      <div className="space-y-3">
        <div className="rounded-lg border border-border bg-background/40 p-3 text-xs text-muted-foreground">
          Rules are persisted in your browser — edits survive page refresh.
          Changes only affect this simulation; export to deploy to your real
          fraud engine.
          <span className="mt-1 block text-sky-400">
            ℹ Tip: use IF / AND / OR / THEN keywords. Tab to indent. Each rule
            runs independently.
          </span>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
            {enabledCount} / {rules.length} active
          </span>
          <Button size="sm" variant="outline" onClick={addRule}>
            <Plus />
            Add Rule
          </Button>
          <Button size="sm" variant="outline" onClick={copyAll}>
            {copied ? <Check /> : <Copy />}
            {copied ? "Copied!" : "Copy All"}
          </Button>
          <Button size="sm" variant="outline" onClick={resetDefaults}>
            <RotateCcw />
            Reset Defaults
          </Button>
          <div className="ml-auto flex items-center gap-2">
            {savedFlash && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
                <Check className="size-3" />
                Saved
              </span>
            )}
            <Button size="sm" onClick={saveAll}>
              <Save />
              Save All
            </Button>
          </div>
        </div>

        {/* Rule cards */}
        <div className="space-y-3">
          {rules.map((rule, idx) => (
            <div
              key={rule.id}
              className={cn(
                "rounded-lg border border-border bg-background/40 p-3 transition-opacity",
                !rule.enabled && "opacity-55"
              )}
            >
              <div className="mb-2 flex items-center gap-2">
                {/* toggle */}
                <button
                  onClick={() => toggleRule(idx)}
                  title={rule.enabled ? "Disable rule" : "Enable rule"}
                  className={cn(
                    "relative h-5 w-9 shrink-0 rounded-full border transition-colors",
                    rule.enabled
                      ? "border-emerald-500/40 bg-emerald-500/30"
                      : "border-border bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 size-3.5 rounded-full bg-foreground transition-transform",
                      rule.enabled ? "translate-x-4" : "translate-x-0.5"
                    )}
                  />
                </button>
                <input
                  value={rule.title}
                  onChange={(e) => editTitle(idx, e.target.value)}
                  placeholder="Rule name..."
                  spellCheck={false}
                  className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm font-medium text-foreground outline-none hover:border-border focus:border-primary/40"
                />
                <button
                  onClick={() => deleteRule(idx)}
                  title="Delete rule"
                  className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-red-500/40 hover:text-red-400"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
              <textarea
                value={rule.body}
                onChange={(e) => editBody(idx, e.target.value)}
                spellCheck={false}
                rows={Math.max(4, rule.body.split("\n").length + 1)}
                className="w-full resize-y rounded-md border border-border bg-background/60 p-2.5 font-mono text-xs leading-relaxed text-foreground/90 outline-none focus:border-primary/40"
              />
            </div>
          ))}
        </div>

        <Button
          variant="outline"
          onClick={addRule}
          className="w-full justify-center"
        >
          <Plus />
          Add new rule
        </Button>
      </div>
    </Modal>
  );
}
