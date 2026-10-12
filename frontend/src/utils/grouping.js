import {
  PROGRESS, PRIORITIES, DUE_GROUPS, LABELS, dueCategory, dateForDueCategory, labelName, bySort,
} from './planner';

export const GROUP_OPTIONS = [
  { key: 'bucket', label: '貯體' },
  { key: 'assignee', label: '指派對象' },
  { key: 'progress', label: '進度' },
  { key: 'dueDate', label: '到期日' },
  { key: 'priority', label: '優先順序' },
  { key: 'labels', label: '標籤' },
];

const byCompletedDesc = (a, b) => String(b.completedAt || '').localeCompare(String(a.completedAt || '')) || bySort(a, b);

/**
 * 依群組方式產生看板欄位
 * 每個欄位：{ key, title, kind, ref, tasks, defaults, patch(task, fromCol), canDrop }
 */
export function buildColumns(groupBy, tasks, { buckets, members, labelNames }) {
  let cols;
  switch (groupBy) {
    case 'progress':
      cols = PROGRESS.map((p) => ({
        key: `p${p.value}`,
        title: p.label,
        kind: 'progress',
        ref: p.value,
        tasks: tasks.filter((t) => t.progress === p.value),
        defaults: { progress: p.value },
        patch: () => ({ progress: p.value }),
      }));
      break;
    case 'priority':
      cols = PRIORITIES.map((p) => ({
        key: `pr${p.value}`,
        title: p.label,
        kind: 'priority',
        ref: p.value,
        tasks: tasks.filter((t) => t.priority === p.value),
        defaults: { priority: p.value },
        patch: () => ({ priority: p.value }),
      }));
      break;
    case 'dueDate':
      cols = DUE_GROUPS.map((g) => ({
        key: `d${g.key}`,
        title: g.label,
        kind: 'due',
        ref: g.key,
        tasks: tasks.filter((t) => dueCategory(t) === g.key),
        defaults: { dueDate: dateForDueCategory(g.key) },
        patch: () => ({ dueDate: dateForDueCategory(g.key) }),
        canDrop: g.key !== 'late',
      }));
      break;
    case 'assignee': {
      const replace = (task, from, toId) => {
        let ids = task.assigneeIds.filter((id) => !(from?.kind === 'assignee' && id === from.ref));
        if (toId && !ids.includes(toId)) ids = [...ids, toId];
        return toId ? ids : [];
      };
      cols = [
        {
          key: 'u0',
          title: '未指派',
          kind: 'assignee',
          ref: 0,
          tasks: tasks.filter((t) => !t.assigneeIds.length),
          defaults: { assigneeIds: [] },
          patch: () => ({ assigneeIds: [] }),
        },
        ...members.map((m) => ({
          key: `u${m.id}`,
          title: m.displayName,
          kind: 'assignee',
          ref: m.id,
          user: m,
          tasks: tasks.filter((t) => t.assigneeIds.includes(m.id)),
          defaults: { assigneeIds: [m.id] },
          patch: (task, from) => ({ assigneeIds: replace(task, from, m.id) }),
        })),
      ];
      break;
    }
    case 'labels': {
      const used = new Set(tasks.flatMap((t) => t.labels));
      Object.entries(labelNames || {}).forEach(([k, v]) => v && used.add(Number(k)));
      const replace = (task, from, toId) => {
        let ids = task.labels.filter((id) => !(from?.kind === 'label' && id === from.ref));
        if (toId && !ids.includes(toId)) ids = [...ids, toId];
        return toId ? ids : [];
      };
      cols = [
        {
          key: 'l0',
          title: '無標籤',
          kind: 'label',
          ref: 0,
          tasks: tasks.filter((t) => !t.labels.length),
          defaults: { labels: [] },
          patch: () => ({ labels: [] }),
        },
        ...LABELS.filter((l) => used.has(l.id)).map((l) => ({
          key: `l${l.id}`,
          title: labelName(labelNames, l.id),
          kind: 'label',
          ref: l.id,
          label: l,
          tasks: tasks.filter((t) => t.labels.includes(l.id)),
          defaults: { labels: [l.id] },
          patch: (task, from) => ({ labels: replace(task, from, l.id) }),
        })),
      ];
      break;
    }
    default:
      cols = buckets.map((b) => ({
        key: `b${b.id}`,
        title: b.name,
        kind: 'bucket',
        ref: b.id,
        bucket: b,
        tasks: tasks.filter((t) => t.bucketId === b.id),
        defaults: { bucketId: b.id },
        patch: () => ({ bucketId: b.id }),
      }));
  }

  const split = groupBy !== 'progress';
  return cols.map((c) => {
    const sorted = [...c.tasks].sort(bySort);
    return {
      canDrop: true,
      ...c,
      split,
      active: split ? sorted.filter((t) => t.progress !== 100) : sorted,
      completed: split ? sorted.filter((t) => t.progress === 100).sort(byCompletedDesc) : [],
    };
  });
}
