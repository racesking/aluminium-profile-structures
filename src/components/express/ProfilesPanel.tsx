import { useExpressStore } from '../../store/expressStore';
import type { ProfileDef } from '../../core/profiles';

type Props = {
  /** Distinct member roles in the current template (for assignment). */
  roles: string[];
};

function ProfileStockBlock({
  profile,
  showHeader,
}: {
  profile: ProfileDef;
  showHeader: boolean;
}) {
  const stockMode = useExpressStore((s) => s.stockMode);
  const stock = useExpressStore((s) => s.stockByProfile[profile.id]);
  const setProfileBuyLength = useExpressStore((s) => s.setProfileBuyLength);
  const addInventoryRow = useExpressStore((s) => s.addInventoryRow);
  const updateInventory = useExpressStore((s) => s.updateInventory);
  const removeInventory = useExpressStore((s) => s.removeInventory);

  if (!stock) return null;

  return (
    <div className="profile-stock">
      {showHeader && (
        <p className="profile-stock-head">
          {profile.name} · {profile.sectionMm} mm
        </p>
      )}

      {stockMode === 'buy' ? (
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Bar length (mm)</label>
          <input
            type="number"
            min={100}
            max={20000}
            step={100}
            value={stock.buyLength}
            onChange={(e) => setProfileBuyLength(profile.id, parseFloat(e.target.value) || 6000)}
          />
        </div>
      ) : (
        <>
          {stock.inventory.map((bar) => (
            <div key={bar.id} className="stock-row">
              <input
                type="number"
                min={1}
                value={bar.length}
                onChange={(e) =>
                  updateInventory(profile.id, bar.id, parseFloat(e.target.value) || 1, bar.quantity)
                }
                title="Length mm"
              />
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>×</span>
              <input
                className="qty"
                type="number"
                min={0}
                value={bar.quantity}
                onChange={(e) =>
                  updateInventory(profile.id, bar.id, bar.length, parseInt(e.target.value, 10) || 0)
                }
                title="Quantity"
              />
              <button
                type="button"
                onClick={() => removeInventory(profile.id, bar.id)}
                disabled={stock.inventory.length <= 1}
                title="Remove"
              >
                ×
              </button>
            </div>
          ))}
          <button type="button" onClick={() => addInventoryRow(profile.id)} style={{ marginTop: 6 }}>
            + Add bars
          </button>
        </>
      )}
    </div>
  );
}

export function ProfilesPanel({ roles }: Props) {
  const profiles = useExpressStore((s) => s.profiles);
  const templateId = useExpressStore((s) => s.templateId);
  const roleMap = useExpressStore((s) => s.roleProfileByTemplate[templateId]) ?? {};
  const stockMode = useExpressStore((s) => s.stockMode);

  const addProfile = useExpressStore((s) => s.addProfile);
  const removeProfile = useExpressStore((s) => s.removeProfile);
  const updateProfile = useExpressStore((s) => s.updateProfile);
  const setRoleProfile = useExpressStore((s) => s.setRoleProfile);
  const setStockMode = useExpressStore((s) => s.setStockMode);

  const multi = profiles.length > 1;
  const profileIdFor = (role: string) =>
    profiles.find((p) => p.id === roleMap[role])?.id ?? profiles[0].id;

  return (
    <>
      <div className="section">
        <p className="section-title">Profiles</p>
        {profiles.map((p) => (
          <div key={p.id} className="profile-row">
            <input
              type="text"
              value={p.name}
              onChange={(e) => updateProfile(p.id, { name: e.target.value })}
              title="Profile name"
            />
            <input
              type="number"
              min={1}
              max={500}
              value={p.sectionMm}
              onChange={(e) => updateProfile(p.id, { sectionMm: parseFloat(e.target.value) || 40 })}
              title="Section size (mm)"
            />
            <span className="profile-row-unit">mm</span>
            <button
              type="button"
              onClick={() => removeProfile(p.id)}
              disabled={profiles.length <= 1}
              title="Remove profile"
            >
              ×
            </button>
          </div>
        ))}
        <button type="button" onClick={addProfile} style={{ marginTop: 6 }}>
          + Add profile
        </button>
      </div>

      {multi && (
        <div className="section">
          <p className="section-title">Member profiles</p>
          {roles.map((role) => (
            <div key={role} className="assign-row">
              <label>{role}</label>
              <select
                value={profileIdFor(role)}
                onChange={(e) => setRoleProfile(role, e.target.value)}
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sectionMm})
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      <div className="section">
        <p className="section-title">Stock</p>
        <div className="seg-toggle">
          <button
            type="button"
            className={stockMode === 'buy' ? 'active' : ''}
            onClick={() => setStockMode('buy')}
          >
            Buy new bars
          </button>
          <button
            type="button"
            className={stockMode === 'inventory' ? 'active' : ''}
            onClick={() => setStockMode('inventory')}
          >
            My inventory
          </button>
        </div>

        {profiles.map((p) => (
          <ProfileStockBlock key={p.id} profile={p} showHeader={multi} />
        ))}

        <p className="hint hint-compact">
          {stockMode === 'buy'
            ? 'Unlimited supply — the optimizer uses as few bars as possible per profile.'
            : 'Shortest usable pieces are consumed first, per profile.'}
        </p>
      </div>
    </>
  );
}
