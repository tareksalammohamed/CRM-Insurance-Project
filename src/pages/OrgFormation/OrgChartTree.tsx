import { forwardRef } from 'react';
import type { OrgChartNode } from './orgChartBuilder';

export type ChartDensity = 'xl' | 'lg' | 'md' | 'sm' | 'xs';

// إعدادات كل مستوى "كثافة" (تتقلّص تدريجيًا كلما زاد عدد الأفراد، حفاظًا على صفحة واحدة)
const DENSITY_SETTINGS: Record<ChartDensity, {
  boxW: number; boxPad: string; gap: number; avatar: number;
  nameHead: number; roleHead: number;
  nameSup: number; roleSup: number;
  nameGl: number; roleGl: number;
  nameAgent: number;
  agentColW: number;
}> = {
  xl: { boxW: 176, boxPad: '12px 16px', gap: 38, avatar: 30, nameHead: 17, roleHead: 12, nameSup: 14.5, roleSup: 10.5, nameGl: 13, roleGl: 10, nameAgent: 12, agentColW: 138 },
  lg: { boxW: 162, boxPad: '11px 14px', gap: 31, avatar: 28, nameHead: 16, roleHead: 11.5, nameSup: 13.5, roleSup: 10,   nameGl: 12.5, roleGl: 9.5, nameAgent: 11.5, agentColW: 128 },
  md: { boxW: 148, boxPad: '9px 12px',  gap: 24, avatar: 25, nameHead: 15, roleHead: 11,   nameSup: 13,   roleSup: 9.5,  nameGl: 12,   roleGl: 9,   nameAgent: 11,   agentColW: 118 },
  sm: { boxW: 134, boxPad: '8px 10px',  gap: 17, avatar: 22, nameHead: 14, roleHead: 10.5, nameSup: 12,   roleSup: 9,    nameGl: 11,   roleGl: 8.5, nameAgent: 10,   agentColW: 108 },
  xs: { boxW: 120, boxPad: '7px 9px',   gap: 12, avatar: 20, nameHead: 13, roleHead: 10,   nameSup: 11,   roleSup: 8.5,  nameGl: 10,   roleGl: 8,   nameAgent: 9,     agentColW: 98  },
};

/** الحرف الأول من الاسم — لشارة الأفاتار الدائرية */
function initial(name: string): string {
  return (name || '').trim().charAt(0) || '؟';
}

function renderNode(node: OrgChartNode): JSX.Element {
  if (node.tier === 2) {
    // رئيس مجموعة: يُعرض كصندوق، وتحته قائمة أسماء الوكلاء فقط (بدون لقب "وكيل")
    return (
      <li key={node.id}>
        <div className="org-box org-box-gl">
          <span className="org-avatar org-avatar-gl">{initial(node.name)}</span>
          <span className="org-box-text">
            <p className="org-name">{node.name}</p>
            <p className="org-role">{node.roleLabel}</p>
          </span>
        </div>
        {node.children.length > 0 && (
          <ul>
            <li className="org-agents-leaf">
              <div className="org-agents-box">
                {node.children.map((a) => (
                  <div key={a.id} className="org-agent-row">
                    <span className="org-agent-dot" />
                    <span className="org-agent-name">{a.name}</span>
                  </div>
                ))}
              </div>
            </li>
          </ul>
        )}
      </li>
    );
  }

  const tierClass = node.tier === 0 ? 'org-box-head' : node.tier === 1 ? 'org-box-sup' : 'org-box-gl';
  const avatarClass = node.tier === 0 ? 'org-avatar-head' : node.tier === 1 ? 'org-avatar-sup' : 'org-avatar-gl';
  // نعكس ترتيب الأبناء بصريًا (والهيكل نفسه يُفرض عليه اتجاه LTR أدناه) عشان يُقرأ
  // التشكيل من اليمين لليسار كما هو متوقع في واجهة عربية، مع بقاء حسابات خطوط
  // الربط الكلاسيكية (first-child / last-child) صحيحة هندسيًا كما صُمّمت أصلاً لـ LTR.
  const children = node.children.length > 0 ? [...node.children].reverse() : node.children;
  return (
    <li key={node.id}>
      <div className={`org-box ${tierClass}`}>
        <span className={`org-avatar ${avatarClass}`}>{initial(node.name)}</span>
        <span className="org-box-text">
          <p className="org-name">{node.name}</p>
          <p className="org-role">{node.roleLabel}</p>
        </span>
      </div>
      {children.length > 0 && (
        <ul>{children.map(renderNode)}</ul>
      )}
    </li>
  );
}

interface OrgChartTreeProps {
  heads: OrgChartNode[];
  branchName: string;
  asOfDateLabel: string;
  companyName: string;
  companyLogoUrl: string | null;
  density: ChartDensity;
  widthPx: number;
}

export const OrgChartTree = forwardRef<HTMLDivElement, OrgChartTreeProps>(function OrgChartTree(
  { heads, branchName, asOfDateLabel, companyName, companyLogoUrl, density, widthPx },
  ref,
) {
  const d = DENSITY_SETTINGS[density];

  return (
    <div
      ref={ref}
      dir="rtl"
      className="org-formation-report"
      style={{ width: widthPx, background: '#ffffff', padding: '26px 30px', boxSizing: 'border-box' }}
    >
      <style>{`
        .org-formation-report { font-family: 'Cairo', 'IBM Plex Sans Arabic', Tahoma, sans-serif; color: #1e293b; }

        /* ── الترويسة ─────────────────────────────────────────────────── */
        .org-formation-report .ofr-brand { display:flex; align-items:center; justify-content:center; gap: 8px; margin-bottom: 10px; }
        .org-formation-report .ofr-brand img { width: 30px; height: 30px; object-fit: contain; }
        .org-formation-report .ofr-brand span { font-size: 12.5px; font-weight: 700; color: #546760; letter-spacing: 0.2px; }
        .org-formation-report .ofr-title { text-align:center; font-size: 23px; font-weight: 800; color:#0d3b33; margin-bottom: 8px; }
        .org-formation-report .ofr-title-rule { height: 3px; width: 56px; background: #16a173; border-radius: 2px; margin: 0 auto 16px; }
        .org-formation-report .ofr-meta {
          display:flex; justify-content:center; align-items:center; gap: 22px;
          font-size: 12.5px; color:#3f544d;
          background: #f2faf6; border: 1px solid #c3e8d7; border-radius: 10px;
          padding: 9px 20px; margin: 0 auto 30px; width: fit-content;
        }
        .org-formation-report .ofr-meta b { color:#0d3b33; font-weight: 700; }
        .org-formation-report .ofr-meta-sep { width: 1px; height: 13px; background: #c3e8d7; }

        /* ── الشجرة وخطوط الربط ───────────────────────────────────────── */
        .org-formation-report .org-tree, .org-formation-report .org-tree ul, .org-formation-report .org-tree li {
          list-style:none; margin:0; padding:0; position:relative;
        }
        /* الشجرة نفسها (خطوط الربط وترتيب الأعمدة) لازم تُبنى بـ LTR دايمًا، لأن تقنية
           خطوط الربط الكلاسيكية (first-child/last-child) مبنية على افتراض LTR، وتحت
           dir=rtl بيتقلب ترتيب flex ويكسر الخطوط. رتبنا الأبناء بالعكس أعلاه (reverse)
           عشان التشكيل يُقرأ بصريًا من اليمين لليسار رغم اتجاه LTR الداخلي. */
        .org-formation-report .org-tree { direction: ltr; }
        .org-formation-report .org-box, .org-formation-report .org-agents-box { direction: rtl; }
        .org-formation-report .org-tree { display:flex; justify-content:center; padding-top: 8px; }
        .org-formation-report .org-tree > ul { display:flex; }
        .org-formation-report .org-tree ul { display:flex; padding-top: ${d.gap}px; }
        .org-formation-report .org-tree li {
          display:flex; flex-direction:column; align-items:center; position:relative;
          padding: ${d.gap}px ${Math.round(d.gap / 3)}px 0;
        }
        .org-formation-report .org-tree li::before,
        .org-formation-report .org-tree li::after {
          content:''; position:absolute; top:0; right:50%; border-top: 1.5px solid #b7c4bd; width:50%; height:${d.gap}px;
        }
        .org-formation-report .org-tree li::after { right:auto; left:50%; border-left: 1.5px solid #b7c4bd; }
        .org-formation-report .org-tree li:only-child::after,
        .org-formation-report .org-tree li:only-child::before { display:none; }
        .org-formation-report .org-tree li:only-child { padding-top:0; }
        .org-formation-report .org-tree li:first-child::before,
        .org-formation-report .org-tree li:last-child::after { border:0 none; }
        .org-formation-report .org-tree li:last-child::before { border-right: 1.5px solid #b7c4bd; }
        .org-formation-report .org-tree ul ul::before {
          content:''; position:absolute; top:0; left:50%; border-left: 1.5px solid #b7c4bd; width:0; height:${d.gap}px;
        }
        /* أول مستوى (رأس التشكيل) بلا خطوط أفقية علوية — مفيش أب يتوصل بيه */
        .org-formation-report .org-tree > ul > li::before,
        .org-formation-report .org-tree > ul > li::after { display:none; }
        .org-formation-report .org-tree > ul > li { padding-top:0; }

        /* ── الصناديق ─────────────────────────────────────────────────── */
        .org-formation-report .org-box {
          width: ${d.boxW}px; padding: ${d.boxPad}; border-radius: 12px;
          display: flex; align-items: center; gap: 9px; text-align: right;
        }
        .org-formation-report .org-box-text { min-width: 0; flex: 1; }
        .org-formation-report .org-name { font-weight: 800; line-height: 1.25; word-break: break-word; }
        .org-formation-report .org-role { line-height: 1.25; margin-top: 2px; font-weight: 600; }

        .org-formation-report .org-avatar {
          flex-shrink: 0; width: ${d.avatar}px; height: ${d.avatar}px; border-radius: 999px;
          display:flex; align-items:center; justify-content:center;
          font-weight: 800; font-size: ${Math.round(d.avatar * 0.42)}px;
        }

        /* المراقب العام — أعلى وزن بصري فى الشجرة */
        .org-formation-report .org-box-head {
          background: #0d3b33; box-shadow: 0 4px 10px -4px rgba(13,59,51,.35);
        }
        .org-formation-report .org-box-head .org-name { font-size: ${d.nameHead}px; color: #ffffff; }
        .org-formation-report .org-box-head .org-role { font-size: ${d.roleHead}px; color: #c5ed58; }
        .org-formation-report .org-avatar-head { background: rgba(255,255,255,.14); color: #eefac4; border: 1px solid rgba(255,255,255,.22); }

        /* المراقب — وزن بصري متوسط-عالٍ */
        .org-formation-report .org-box-sup {
          background: #066a4c; box-shadow: 0 3px 8px -4px rgba(6,106,76,.32);
        }
        .org-formation-report .org-box-sup .org-name { font-size: ${d.nameSup}px; color: #ffffff; }
        .org-formation-report .org-box-sup .org-role { font-size: ${d.roleSup}px; color: #cdeee0; }
        .org-formation-report .org-avatar-sup { background: rgba(255,255,255,.16); color: #ffffff; border: 1px solid rgba(255,255,255,.24); }

        /* رئيس المجموعة — كارت أبيض بشريط علوي، وزن متوسط */
        .org-formation-report .org-box-gl {
          background: #ffffff; border: 1px solid #dfe9e3; border-top: 3px solid #16a173;
          box-shadow: 0 1px 3px rgba(15,23,42,.06);
        }
        .org-formation-report .org-box-gl .org-name { font-size: ${d.nameGl}px; color: #0d2925; }
        .org-formation-report .org-box-gl .org-role { font-size: ${d.roleGl}px; color: #6b7f77; }
        .org-formation-report .org-avatar-gl { background: #e6f5ee; color: #066a4c; }

        /* قائمة الوكلاء — أقل وزن بصري، للقراءة السريعة */
        .org-formation-report .org-tree li.org-agents-leaf { padding-top: ${Math.round(d.gap * 0.65)}px; }
        .org-formation-report .org-agents-box {
          width: ${d.agentColW}px; background:#fbfcfb; border:1px solid #eef2f0; border-radius: 10px;
          padding: 5px 10px; display:flex; flex-direction:column;
        }
        .org-formation-report .org-agent-row {
          display: flex; align-items: center; gap: 6px;
          padding: 5px 0; border-bottom: 1px dashed #e3e9e6;
        }
        .org-formation-report .org-agent-row:last-child { border-bottom: none; }
        .org-formation-report .org-agent-dot { flex-shrink:0; width: 5px; height: 5px; border-radius: 999px; background: #8fd4b7; }
        .org-formation-report .org-agent-name {
          font-size: ${d.nameAgent}px; font-weight: 600; color:#3f544d; text-align:right; line-height: 1.3;
        }
      `}</style>

      <div className="ofr-brand">
        {companyLogoUrl && <img src={companyLogoUrl} alt={companyName} />}
        <span>{companyName}</span>
      </div>
      <div className="ofr-title">تشكيل الجهاز الإنتاجي</div>
      <div className="ofr-title-rule" />
      <div className="ofr-meta">
        <span><b>الفرع:</b> {branchName || '—'}</span>
        <span className="ofr-meta-sep" />
        <span><b>اعتبارًا من:</b> {asOfDateLabel || '—'}</span>
      </div>

      <div className="org-tree">
        <ul>{(heads.length > 0 ? [...heads].reverse() : heads).map(renderNode)}</ul>
      </div>
    </div>
  );
});
