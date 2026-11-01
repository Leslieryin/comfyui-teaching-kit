// 校验 workflows/*.json 的结构与引用完整性。
// 只做静态检查：JSON 能否解析、节点/连线字段是否齐全、连线两端节点是否存在、id 是否自洽。
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'workflows';
const files = readdirSync(DIR).filter((f) => f.endsWith('.json')).sort();

if (files.length === 0) {
  console.error(`在 ${DIR}/ 下没有找到任何 .json 工作流`);
  process.exit(1);
}

let failed = 0;

for (const file of files) {
  const errors = [];
  let wf;

  try {
    wf = JSON.parse(readFileSync(join(DIR, file), 'utf8'));
  } catch (e) {
    console.error(`FAIL ${file} — JSON 解析失败: ${e.message}`);
    failed++;
    continue;
  }

  for (const key of ['nodes', 'links', 'last_node_id', 'last_link_id', 'version']) {
    if (!(key in wf)) errors.push(`缺少顶层字段 ${key}`);
  }

  const nodes = Array.isArray(wf.nodes) ? wf.nodes : [];
  const links = Array.isArray(wf.links) ? wf.links : [];

  if (!Array.isArray(wf.nodes)) errors.push('nodes 必须是数组');
  if (!Array.isArray(wf.links)) errors.push('links 必须是数组');

  const nodeIds = new Set();
  let maxNodeId = 0;

  for (const node of nodes) {
    if (typeof node.id !== 'number') {
      errors.push(`节点缺少数字 id: ${JSON.stringify(node).slice(0, 60)}`);
      continue;
    }
    if (nodeIds.has(node.id)) errors.push(`节点 id 重复: ${node.id}`);
    nodeIds.add(node.id);
    maxNodeId = Math.max(maxNodeId, node.id);

    if (!node.type) errors.push(`节点 ${node.id} 缺少 type`);
    if (!Array.isArray(node.pos) || node.pos.length !== 2) errors.push(`节点 ${node.id} 的 pos 不是 [x, y]`);
    if (!Array.isArray(node.size) || node.size.length !== 2) errors.push(`节点 ${node.id} 的 size 不是 [w, h]`);
  }

  if (typeof wf.last_node_id === 'number' && maxNodeId > wf.last_node_id) {
    errors.push(`last_node_id(${wf.last_node_id}) 小于实际最大节点 id(${maxNodeId})`);
  }

  let maxLinkId = -1;
  const seenLinkIds = new Set();
  const declaredLinks = new Set();

  // 先收集每个节点输入/输出槽位声明的 link id，用于与顶层 links 交叉印证
  for (const node of nodes) {
    for (const side of ['inputs', 'outputs']) {
      if (!Array.isArray(node[side])) continue;
      node[side].forEach((slot, i) => {
        if (slot && typeof slot.link === 'number') {
          declaredLinks.add(slot.link);
          const cap = side === 'inputs' ? (Array.isArray(node.inputs) ? node.inputs.length : 0)
                                        : (Array.isArray(node.outputs) ? node.outputs.length : 0);
          if (i >= cap) errors.push(`节点 ${node.id} 的 ${side}[${i}] 槽位越界（共 ${cap} 个）`);
        }
      });
    }
  }

  for (const link of links) {
    if (!Array.isArray(link) || link.length !== 6) {
      errors.push(`连线格式错误（应为 6 元组）: ${JSON.stringify(link)}`);
      continue;
    }
    const [linkId, originNode, originSlot, targetNode, targetSlot, linkType] = link;
    if (typeof linkId === 'number') maxLinkId = Math.max(maxLinkId, linkId);
    if (seenLinkIds.has(linkId)) errors.push(`连线 id 重复: ${linkId}`);
    seenLinkIds.add(linkId);
    if (!nodeIds.has(originNode)) errors.push(`连线 ${linkId} 的起点节点 ${originNode} 不存在`);
    if (!nodeIds.has(targetNode)) errors.push(`连线 ${linkId} 的终点节点 ${targetNode} 不存在`);
    if (originSlot < 0 || targetSlot < 0) errors.push(`连线 ${linkId} 的槽位为负数`);
    // 槽位上界：起点输出槽 / 终点输入槽
    if (nodeIds.has(originNode)) {
      const n = nodes.find((x) => x.id === originNode);
      const cap = Array.isArray(n?.outputs) ? n.outputs.length : 0;
      if (originSlot >= cap) errors.push(`连线 ${linkId} 的起点槽位 ${originSlot} 超出节点 ${originNode} 的输出槽数 ${cap}`);
    }
    if (nodeIds.has(targetNode)) {
      const n = nodes.find((x) => x.id === targetNode);
      const cap = Array.isArray(n?.inputs) ? n.inputs.length : 0;
      if (targetSlot >= cap) errors.push(`连线 ${linkId} 的终点槽位 ${targetSlot} 超出节点 ${targetNode} 的输入槽数 ${cap}`);
    }
    // 交叉印证：顶层 links 数组里的连线，应被两端节点各自的 inputs/outputs.link 声明
    if (!declaredLinks.has(linkId)) {
      errors.push(`连线 ${linkId} 存在于顶层 links 但未在两端节点的槽位中声明`);
    }
  }

  // 反向印证：节点槽位声明的 link 必须存在于顶层 links
  for (const id of declaredLinks) {
    if (!seenLinkIds.has(id)) errors.push(`节点槽位声明的连线 ${id} 不存在于顶层 links 数组`);
  }

  if (typeof wf.last_link_id === 'number' && maxLinkId > wf.last_link_id) {
    errors.push(`last_link_id(${wf.last_link_id}) 小于实际最大连线 id(${maxLinkId})`);
  }

  if (errors.length > 0) {
    failed++;
    console.error(`FAIL ${file}`);
    for (const msg of errors.slice(0, 10)) console.error(`   - ${msg}`);
    if (errors.length > 10) console.error(`   - ...另有 ${errors.length - 10} 项`);
  } else {
    console.log(`OK   ${file} — ${nodes.length} 个节点 / ${links.length} 条连线`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} 个工作流未通过校验`);
  process.exit(1);
}
console.log(`\n全部 ${files.length} 个工作流通过校验`);
