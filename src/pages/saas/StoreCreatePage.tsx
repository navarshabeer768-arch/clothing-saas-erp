import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Card, CardBody, Input, Select, Button, useToast } from '../../components/ui';
import { createStore } from '../../features/store-management/storeManagementService';
import { AppError } from '../../lib/errors';

interface FormState {
  businessName: string;
  legalName: string;
  ownerName: string;
  mobile: string;
  whatsapp: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  currencyCode: string;
  timezone: string;
  taxNumber: string;
  adminFullName: string;
  adminLoginId: string;
  adminPassword: string;
  adminConfirmPassword: string;
  adminPhone: string;
}

const INITIAL_STATE: FormState = {
  businessName: '',
  legalName: '',
  ownerName: '',
  mobile: '',
  whatsapp: '',
  email: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  country: '',
  postalCode: '',
  currencyCode: 'QAR',
  timezone: 'Asia/Qatar',
  taxNumber: '',
  adminFullName: '',
  adminLoginId: 'admin',
  adminPassword: '',
  adminConfirmPassword: '',
  adminPhone: '',
};

const CURRENCY_OPTIONS = ['QAR', 'AED', 'SAR', 'USD', 'INR', 'KWD', 'BHD', 'OMR', 'EUR', 'GBP'];
const TIMEZONE_OPTIONS = ['Asia/Qatar', 'Asia/Dubai', 'Asia/Riyadh', 'Asia/Kolkata', 'Asia/Kuwait', 'Asia/Bahrain', 'UTC'];

export function StoreCreatePage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdResult, setCreatedResult] = useState<{ storeCode: string; adminLoginId: string } | null>(null);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (isSubmitting) return;

    setErrors({});
    setIsSubmitting(true);
    try {
      const result = await createStore({
        businessName: form.businessName,
        legalName: form.legalName || undefined,
        ownerName: form.ownerName,
        mobile: form.mobile,
        whatsapp: form.whatsapp || undefined,
        email: form.email || undefined,
        addressLine1: form.addressLine1,
        addressLine2: form.addressLine2 || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        country: form.country,
        postalCode: form.postalCode || undefined,
        currencyCode: form.currencyCode,
        timezone: form.timezone,
        taxNumber: form.taxNumber || undefined,
        admin: {
          fullName: form.adminFullName,
          loginId: form.adminLoginId,
          password: form.adminPassword,
          confirmPassword: form.adminConfirmPassword,
          phone: form.adminPhone || undefined,
        },
      });
      setCreatedResult({ storeCode: result.store.storeCode, adminLoginId: result.admin.loginId });
      showToast('Store created successfully.', 'success');
    } catch (err) {
      if (err instanceof AppError && err.context && typeof err.context === 'object' && 'errors' in (err.context as Record<string, unknown>)) {
        setErrors((err.context as { errors: Record<string, string> }).errors);
      }
      showToast(err instanceof AppError ? err.message : 'Could not create the store.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (createdResult) {
    return (
      <div>
        <PageHeader title="Store Created Successfully" />
        <Card>
          <CardBody>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-brand-400">Store ID</dt>
                <dd className="mt-1 text-lg font-semibold text-brand-900">{createdResult.storeCode}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-brand-400">Store Admin Login ID</dt>
                <dd className="mt-1 text-lg font-semibold text-brand-900">{createdResult.adminLoginId}</dd>
              </div>
            </dl>
            <p className="mt-4 text-sm text-brand-500">
              The password entered during setup has not been stored anywhere else and won't be shown again — make
              sure it was shared securely with the store's admin.
            </p>
            <div className="mt-6 flex gap-2">
              <Button onClick={() => navigate('/saas/stores')}>Back to Stores</Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setCreatedResult(null);
                  setForm(INITIAL_STATE);
                }}
              >
                Add Another Store
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Add Store" description="Create a new tenant and its first Store Admin." />
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Card>
          <CardBody>
            <h2 className="mb-4 text-sm font-semibold text-brand-800">Business</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Business Name" required value={form.businessName} onChange={(e) => updateField('businessName', e.target.value)} error={errors.businessName} />
              <Input label="Legal Name (optional)" value={form.legalName} onChange={(e) => updateField('legalName', e.target.value)} />
              <Input label="Owner Name" required value={form.ownerName} onChange={(e) => updateField('ownerName', e.target.value)} error={errors.ownerName} />
              <Input label="Mobile" required value={form.mobile} onChange={(e) => updateField('mobile', e.target.value)} error={errors.mobile} />
              <Input label="WhatsApp (optional)" value={form.whatsapp} onChange={(e) => updateField('whatsapp', e.target.value)} />
              <Input label="Email (optional)" type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} error={errors.email} />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="mb-4 text-sm font-semibold text-brand-800">Address</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Address Line 1" required value={form.addressLine1} onChange={(e) => updateField('addressLine1', e.target.value)} error={errors.addressLine1} className="sm:col-span-2" />
              <Input label="Address Line 2 (optional)" value={form.addressLine2} onChange={(e) => updateField('addressLine2', e.target.value)} className="sm:col-span-2" />
              <Input label="City (optional)" value={form.city} onChange={(e) => updateField('city', e.target.value)} />
              <Input label="State/Province (optional)" value={form.state} onChange={(e) => updateField('state', e.target.value)} />
              <Input label="Country" required value={form.country} onChange={(e) => updateField('country', e.target.value)} error={errors.country} />
              <Input label="Postal Code (optional)" value={form.postalCode} onChange={(e) => updateField('postalCode', e.target.value)} />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="mb-4 text-sm font-semibold text-brand-800">Regional Settings &amp; Tax</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select label="Currency" value={form.currencyCode} onChange={(e) => updateField('currencyCode', e.target.value)} error={errors.currencyCode}>
                {CURRENCY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
              <Select label="Timezone" value={form.timezone} onChange={(e) => updateField('timezone', e.target.value)} error={errors.timezone}>
                {TIMEZONE_OPTIONS.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </Select>
              <Input label="Tax/VAT Number (optional)" value={form.taxNumber} onChange={(e) => updateField('taxNumber', e.target.value)} className="sm:col-span-2" />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="mb-4 text-sm font-semibold text-brand-800">Initial Store Admin</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Full Name" required value={form.adminFullName} onChange={(e) => updateField('adminFullName', e.target.value)} error={errors.adminFullName} />
              <Input label="Login ID" required value={form.adminLoginId} onChange={(e) => updateField('adminLoginId', e.target.value)} error={errors.adminLoginId} />
              <Input label="Phone (optional)" value={form.adminPhone} onChange={(e) => updateField('adminPhone', e.target.value)} />
              <div />
              <Input
                label="Password"
                type="password"
                required
                value={form.adminPassword}
                onChange={(e) => updateField('adminPassword', e.target.value)}
                error={errors.adminPassword}
                hint="At least 8 characters."
              />
              <Input
                label="Confirm Password"
                type="password"
                required
                value={form.adminConfirmPassword}
                onChange={(e) => updateField('adminConfirmPassword', e.target.value)}
                error={errors.adminConfirmPassword}
              />
            </div>
          </CardBody>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/saas/stores')}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Create Store
          </Button>
        </div>
      </form>
    </div>
  );
}
