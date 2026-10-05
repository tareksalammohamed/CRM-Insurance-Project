      `}</style>

      {/* ══ صفحة 1: التجميعات (هيكل إداري بحت — بدون تفاصيل عملاء) ══
          دايمًا صفحة واحدة بس — كل المراقبين ورؤساء مجموعاتهم بيترسموا
          ورا بعض من غير أي فاصل صفحات، وحجم الجداول/الخطوط بيصغر تلقائيًا
          (pr-agg-tier-1/2/3) على حسب إجمالي عدد الصفوف عشان يفضل الكل
          داخل صفحة واحدة. */}
      <div className={`pr-agg-section${aggTierClass}`}>
        <div className="pr-company">
          <span>{branding.company_name}</span>
        </div>
        <div className="pr-title">تقرير تقفيل الشهر</div>
        <div className="pr-sub">صفحة التجميعات</div>
        <div className="pr-title-rule" />
        <div className="pr-meta">
          <span><b>{supervisorRoleLabel}:</b> {supervisorName}</span>
          <span><b>الشهر:</b> {monthLabel}</span>
          {branchName && <span><b>الفرع:</b> {branchName}</span>}
          <span><b>تاريخ التقفيل:</b> {closingDate}</span>
        </div>

        {visibleSupervisors.map((sv) => (
          <div key={sv.id} style={{ marginBottom: aggBlockGap }}>
            <div className="pr-sup-name" style={{ margin: `${aggBlockGap - 2}px 0 4px` }}>
              {ROLE_LABELS[sv.role]}: {sv.name}
            </div>
            <table>
              <thead>
                <tr>
                  <th scope="col" style={{ width: '32%' }}>البيان</th>
                  <th scope="col">إجمالي الجديد</th>
                  <th scope="col">إجمالي التحصيل</th>
                  <th scope="col">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {sv.groupLeaders.map((gl) => (
                  <tr key={gl.id} className="pr-group-row">
                    <td>
                      {gl.name}
                      {gl.roleNote && <div className="pr-role-note">({gl.roleNote})</div>}
                    </td>
                    <td>{fmt(gl.production)}</td>
                    <td>{fmt(gl.collection)}</td>
                    <td>{fmt(gl.total)}</td>
                  </tr>
                ))}
                {sv.groupLeaders.length === 0 && (
                  <tr><td colSpan={4}>لا توجد مجموعات لهذا المراقب</td></tr>
                )}
                <tr className="pr-totals-row">
                  <td>إجمالي {sv.name}</td>
                  <td>{fmt(sv.production)}</td>
                  <td>{fmt(sv.collection)}</td>
                  <td>{fmt(sv.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ))}

        {visibleSupervisors.length === 0 && (
          <p style={{ textAlign: 'center', margin: '20px 0' }}>لا توجد بيانات لهذا الشهر</p>
        )}

        <div className="pr-grand-box">
          <div className="row"><span>إجمالي {supervisorRoleLabel} — الإنتاج الجديد</span><span>{fmt(grandProduction)}</span></div>
          <div className="row"><span>إجمالي {supervisorRoleLabel} — التحصيل</span><span>{fmt(grandCollection)}</span></div>
          <div className="row total"><span>إجمالي {supervisorRoleLabel} — الإجمالي الكلي</span><span>{fmt(grandTotal)}</span></div>
        </div>

        <div className="pr-footer">
          تقرير تقفيل الشهر — {monthLabel} · صفحة 1
        </div>
      </div>

      {/* ══ الصفحة الثانية وما بعدها: عمليات السداد، مقسّمة لصفحات مستقلة ══
          كل صفحة جدول قائم بذاته وله ترويسته الخاصة (اسم المراقب + الشهر)
          ورقم صفحته الصحيح، بدل جدول واحد طويل بيعتمد على تكرار تلقائي
          ممكن يفشل بعد أول صفحة. */}
      {(() => {
        // ══ صفحات التفاصيل بقت قسمين منفصلين تمامًا: "الإنتاج الجديد" لوحده
        // ثم "التحصيل" لوحده — كل قسم له صفحاته الخاصة، ترقيمه المتسلسل،
        // شارته الملوّنة فى رأس كل صفحة، وصف إجماليه الخاص فى آخر صفحة منه.
        // بما إن كل صفحة بقت مخصّصة لنوع واحد بس، اتشال عمود "نوع العملية"
        // اللي كان بيتكرر فى كل صف (بقى غير لازم ومكانه استُغل لتوسعة باقي
        // الأعمدة بدل ما يتزاحموا).
        type SectionKey = 'new' | 'collection';
        const SECTION_META: Record<SectionKey, { label: string; emptyMessage: string; totalLabel: string; tagClass: string; tableClass: string }> = {
          new: {
            label: 'الإنتاج الجديد',
            emptyMessage: 'لا توجد عمليات إنتاج جديد مسجّلة لهذا الشهر',
            totalLabel: 'الإجمالي الكلي — الإنتاج الجديد',
            tagClass: 'pr-section-tag-new',
            tableClass: 'pr-section-new',
          },
          collection: {
            label: 'التحصيل',
            emptyMessage: 'لا توجد عمليات تحصيل مسجّلة لهذا الشهر',
            totalLabel: 'الإجمالي الكلي — التحصيل',
            tagClass: 'pr-section-tag-collection',
            tableClass: 'pr-section-collection',
          },
        };

        function renderSection(rows: PrintDetailRow[], sectionKey: SectionKey, sectionTotal: number, startPageNumber: number) {
          const meta = SECTION_META[sectionKey];
          const detailGroups = buildDetailGroups(rows);
          const detailPages = paginateDetailGroups(detailGroups, DETAIL_ROWS_PER_PAGE);

          if (detailPages.length === 0) {
            return [(
              <div className="pr-page-break pr-detail-page" key={`${sectionKey}-empty`}>
                <table className={`pr-detail-table ${meta.tableClass}`}>
                  <thead>
                    <tr className="pr-detail-title-row">
                      <th scope="col" colSpan={4}>
                        <div className="pr-company-flat">
                          <span>{branding.company_name}</span>
                        </div>
                        <div className="pr-title">تقرير تقفيل الشهر</div>
                        <div className={`pr-section-tag ${meta.tagClass}`}>قسم: {meta.label}</div>
                      </th>
                    </tr>
                    <tr className="pr-detail-meta-row">
                      <th scope="col" colSpan={2}>{supervisorRoleLabel}: {supervisorName}</th>
                      <th scope="col" colSpan={2}>الشهر: {monthLabel}{branchName && ` — الفرع: ${branchName}`}</th>
                    </tr>
                    <tr>
                      <th scope="col">العميل</th>
                      <th scope="col">آخر 6 أرقام الوثيقة</th>
                      <th scope="col">رقم القسط</th>
                      <th scope="col">قيمة القسط</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td colSpan={4}>{meta.emptyMessage}</td></tr>
                  </tbody>
                </table>
                <div className="pr-footer">
                  تقرير تقفيل الشهر — {monthLabel} · صفحة {startPageNumber}
                </div>
              </div>
            )];
          }

          return detailPages.map((rowsOnPage, pageIdx) => {
            const pageNumber = pageIdx + startPageNumber;
            const isLastPage = pageIdx === detailPages.length - 1;
            // بنصفّر السياق (آخر مراقب/رئيس مجموعة ظاهر) فى أول كل صفحة، عشان
            // أول مجموعة فى أي صفحة جديدة تظهر ترويستها كاملة دايمًا — القارئ
            // لازم يعرف "أنا تحت مين" من أول نظرة على الصفحة، حتى لو الاستمرارية
            // من نفس المراقب/رئيس المجموعة اللي انتهت بيه الصفحة اللي قبلها.
            let lastSupervisor = '';
            let lastGroupLeader = '';
            return (
              <div className="pr-page-break pr-detail-page" key={`${sectionKey}-${pageIdx}`}>
                <table className={`pr-detail-table ${meta.tableClass}`}>
                  <thead>
                    <tr className="pr-detail-title-row">
                      <th scope="col" colSpan={4}>
                        <div className="pr-company-flat">
                          <span>{branding.company_name}</span>
                        </div>
                        <div className="pr-title">تقرير تقفيل الشهر</div>
                        <div className={`pr-section-tag ${meta.tagClass}`}>قسم: {meta.label}</div>
                      </th>
                    </tr>
                    <tr className="pr-detail-meta-row">
                      <th scope="col" colSpan={2}>{supervisorRoleLabel}: {supervisorName}</th>
                      <th scope="col" colSpan={2}>الشهر: {monthLabel}{branchName && ` — الفرع: ${branchName}`}</th>
                    </tr>
                    <tr>
                      <th scope="col">العميل</th>
                      <th scope="col">آخر 6 أرقام الوثيقة</th>
                      <th scope="col">رقم القسط</th>
                      <th scope="col">قيمة القسط</th>
                    </tr>
                  </thead>
                  {chunkPageIntoAgentBlocks(rowsOnPage).map((block, blockIdx) => {
                    const ctx = blockContext(block);
                    const showSupervisorHeader = ctx.supervisorName !== lastSupervisor;
                    // "إنتاج شخصي" مش رئيس مجموعة حقيقي — مفيش داعي لسطر مستوى
                    // إضافي ليه، بيتحط مباشرة تحت المراقب/رئيس المجموعة صاحبه.
                    const showGroupLeaderHeader =
                      ctx.groupLeaderName !== PERSONAL_PRODUCTION_LABEL &&
                      (showSupervisorHeader || ctx.groupLeaderName !== lastGroupLeader);
                    lastSupervisor = ctx.supervisorName;
                    lastGroupLeader = ctx.groupLeaderName;
                    return (
                      <tbody className="pr-agent-block" key={blockIdx}>
                        {showSupervisorHeader && (
                          <tr className="pr-detail-sup-header">
                            <td colSpan={4}>{ROLE_LABELS[ctx.supervisorRole]}: {ctx.supervisorName}</td>
                          </tr>
                        )}
                        {showGroupLeaderHeader && (
                          <tr className="pr-detail-gl-header">
                            <td colSpan={4}>
                              {/* الاسم الحقيقي دايمًا — سواء رئيس مجموعة فعلي، أو
                                  صاحب الإنتاج نفسه لما يكون تابعًا لمستوى إدارى
                                  مباشرة (وقتها التصنيف تحته بيوضّح تبعيته). */}
                              {ctx.groupLevelIsOwner || ctx.groupLevelNote
                                ? ctx.groupLeaderName
                                : `رئيس المجموعة: ${ctx.groupLeaderName}`}
                              {ctx.groupLevelNote && (
                                <div className="pr-level-note">{ctx.groupLevelNote}</div>
                              )}
                            </td>
                          </tr>
                        )}
                        {/* لو الاسم اللى فوق هو صاحب الإنتاج نفسه، مفيش داعى
                            نكرره تانى فى سطر الوكيل تحته مباشرة. */}
                        {!ctx.groupLevelIsOwner && (
                          <tr className="pr-detail-agent-header">
                            <td colSpan={4}>{subtotalLabel(ctx)}</td>
                          </tr>
                        )}
                        {block.map((entry, i) => {
                          if (entry.kind === 'subtotal') {
                            return (
                              <tr key={i} className="pr-agent-subtotal-row">
                                <td colSpan={3}>إجمالي {subtotalLabel(entry)}</td>
                                <td>{fmt(entry.amount)}</td>
                              </tr>
                            );
                          }
                          const r = entry.row;
                          return (
                            <tr key={i}>
                              <td style={{ textAlign: 'right' }}>{r.customerName}</td>
                              <td dir="ltr">{last6(r.policyNumber)}</td>
                              <td>{r.installmentNumber}</td>
                              <td>{fmt(r.amount)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    );
                  })}
                  {isLastPage && (
                    <tfoot>
                      <tr className="pr-totals-row">
                        <td colSpan={3}>{meta.totalLabel}</td>
                        <td>{fmt(sectionTotal)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
                <div className="pr-footer">
                  تقرير تقفيل الشهر — {monthLabel} · صفحة {pageNumber}
                </div>
              </div>
            );
          });
        }

        const newRows = printDetailRows.filter((r) => r.type === 'new');
        const collectionRows = printDetailRows.filter((r) => r.type === 'collection');
        const newPages = renderSection(newRows, 'new', grandProduction, totalAggPages + 1);
        const collectionPages = renderSection(collectionRows, 'collection', grandCollection, totalAggPages + newPages.length + 1);

        const detailPageCount = newPages.length + collectionPages.length;
        const formationPage = 2 + detailPageCount;
        const memoStartPage = formationPage + (selectedFormationUsers.length > 0 ? 1 : 0);

        return <>
          {newPages}
          {collectionPages}
          {selectedFormationUsers.length > 0 && (
            <div className="pr-formation-page">
              <div className="pr-company">
                <span>{branding.company_name}</span>
              </div>
              <div className="pr-title">تشكيل الجهاز الإنتاجي</div>
              <div className="pr-sub">اعتبارًا من {formationDate || '01/—/——'}{branchName && ` — الفرع: ${branchName}`}</div>
              <p className="pr-formation-note">المستخدمون الذين أُنشئت حساباتهم خلال شهر التقفيل ولهم مسددات ظاهرة في التقرير</p>
              <table className="pr-formation-table">
                <thead><tr><th>م</th><th>الاسم</th><th>المسمى الوظيفي</th><th>التبعية</th></tr></thead>
                <tbody>
                  {selectedFormationUsers.map((u, index) => (
                    <tr key={u.id}>
                      <td>{index + 1}</td>
                      <td className="font-semibold">{u.name}</td>
                      <td>{ROLE_LABELS[u.role]}</td>
                      <td>{u.managerName || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="pr-footer">التشكيل · صفحة {formationPage}</div>
            </div>
          )}
          {memoSupervisors.map((sv, idx) => (
            <RecommendationMemo
              key={`memo-${sv.id}`}
              supervisor={sv}
              branchName={branchName}
              monthLabel={monthLabel}
              printDate={closingDate}
              pageNumber={memoStartPage + idx}
            />
          ))}
        </>;
      })()}
    </div>
  );
}
