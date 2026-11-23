import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  salesService,
  SalesRep,
  CreateSalesRepData,
  Country,
  Region,
  Route as SalesRoute,
  SalesRepProfile,
  ContactEntry,
  EducationEntry,
  ExperienceEntry,
  ReferenceEntry,
} from '../services/salesService';
import { withCurrent } from '../constants/staffOptions';
import { useAuth } from '../contexts/AuthContext';

/** Add / edit a sales rep, team leader or driver, with the same sections as the staff list form. */
const MODAL_TABS = [
  { id: 'personal', label: 'Personal Details' },
  { id: 'offer', label: 'Offer Details' },
  { id: 'beneficiary', label: 'Nominated Beneficiary' },
  { id: 'emergency', label: 'Emergency Contact' },
  { id: 'family', label: 'Family Details' },
  { id: 'statutory', label: 'Statutory Details' },
  { id: 'bank', label: 'Bank Details' },
  { id: 'education', label: 'Education Details' },
  { id: 'experience', label: 'Work Experience' },
  { id: 'references', label: 'References' },
];

const BENEFICIARY_RELATIONSHIPS = ['Spouse', 'Child', 'Parent', 'Sibling', 'Other'];
const FAMILY_RELATIONSHIPS = ['Father', 'Mother', 'Brother', 'Sister', 'Spouse', 'Child', 'Other'];

const emptyContact = (): ContactEntry => ({ name: '', relationship: '', contact: '' });
const emptyEducation = (): EducationEntry => ({ institution: '', qualification: '', year: '' });
const emptyExperience = (): ExperienceEntry => ({ organization: '', designation: '', from: '', to: '', reason: '' });
const emptyReference = (): ReferenceEntry => ({ name: '', position: '', company: '', phone: '', email: '' });

/** Pad a saved list out to a fixed number of rows so every slot shows in the form. */
const padRows = <T,>(rows: T[] | undefined, count: number, make: () => T): T[] => {
  const out = [...(rows || [])].slice(0, count);
  while (out.length < count) out.push(make());
  return out;
};

const emptyProfile = (): SalesRepProfile => ({
  id_no: '', gender: '', date_of_birth: '', marital_status: '', nationality: '', address: '',
  empl_no: '', designation: '', employment_type: 'Permanent', offer_date: '', start_date: '', department_email: '',
  benefits: ['', '', ''],
  beneficiaries: padRows([], 2, emptyContact),
  emergency_contacts: padRows([], 2, emptyContact),
  family: padRows([], 3, emptyContact),
  nhif_number: '', nssf_number: '', kra_pin: '', passport_number: '',
  bank_name: '', bank_branch: '', account_number: '', account_name: '', swift_code: '',
  education: padRows([], 5, emptyEducation),
  work_experience: padRows([], 5, emptyExperience),
  references: padRows([], 2, emptyReference),
});

const normaliseProfile = (p: SalesRepProfile): SalesRepProfile => ({
  ...emptyProfile(),
  ...p,
  benefits: padRows(p.benefits, 3, () => ''),
  beneficiaries: padRows(p.beneficiaries, 2, emptyContact),
  emergency_contacts: padRows(p.emergency_contacts, 2, emptyContact),
  family: padRows(p.family, 3, emptyContact),
  education: padRows(p.education, 5, emptyEducation),
  work_experience: padRows(p.work_experience, 5, emptyExperience),
  references: padRows(p.references, 2, emptyReference),
});

/** Drop blank rows before saving. */
const cleanProfile = (p: SalesRepProfile): SalesRepProfile => {
  const filled = (o: object) => Object.values(o).some(v => String(v ?? '').trim() !== '');
  return {
    ...p,
    benefits: (p.benefits || []).map(b => b.trim()).filter(Boolean),
    beneficiaries: (p.beneficiaries || []).filter(filled),
    emergency_contacts: (p.emergency_contacts || []).filter(filled),
    family: (p.family || []).filter(filled),
    education: (p.education || []).filter(filled),
    work_experience: (p.work_experience || []).filter(filled),
    references: (p.references || []).filter(filled),
  };
};

type RowList = 'beneficiaries' | 'emergency_contacts' | 'family' | 'education' | 'work_experience' | 'references';

const SalesRepFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { user } = useAuth();
  const isTeamLeaderUser = user?.role === 'team_leader' || user?.role === 'leader';

  const [salesRep, setSalesRep] = useState<SalesRep | undefined>();
  const [repLoading, setRepLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateSalesRepData & { status?: number }>({
    name: '',
    email: '',
    phoneNumber: '',
    country: '',
    region: '',
    route_name_update: '',
    photoUrl: '',
    role: 'sales rep',
    expected_weekly_coverage: undefined,
    basic_salary: undefined,
    status: 1,
  });
  const [profile, setProfile] = useState<SalesRepProfile>(emptyProfile());
  const [profileLoading, setProfileLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('personal');
  const [countries, setCountries] = useState<Country[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [routes, setRoutes] = useState<SalesRoute[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    salesService.getCountries().then(setCountries);
    salesService.getRoutes().then(setRoutes);
  }, []);

  // Load the rep being edited
  useEffect(() => {
    if (!id) {
      setSalesRep(undefined);
      setRepLoading(false);
      return;
    }
    let cancelled = false;
    setRepLoading(true);
    setLoadError(null);
    salesService
      .getSalesRepById(Number(id))
      .then(rep => { if (!cancelled) setSalesRep(rep); })
      .catch((err: any) => { if (!cancelled) setLoadError(err.response?.data?.error || err.message || 'Failed to load staff member'); })
      .finally(() => { if (!cancelled) setRepLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (formData.country) {
      const selectedCountry = countries.find(c => c.name === formData.country);
      if (selectedCountry) {
        salesService.getRegions(selectedCountry.id).then(setRegions);
      } else {
        setRegions([]);
      }
    } else {
      setRegions([]);
    }
  }, [formData.country, countries]);

  useEffect(() => {
    if (salesRep) {
      setFormData({
        name: salesRep.name,
        email: salesRep.email,
        phoneNumber: salesRep.phoneNumber || '',
        country: salesRep.country || '',
        region: salesRep.region || '',
        route_name_update: salesRep.route_name_update || '',
        photoUrl: salesRep.photoUrl || '',
        role: salesRep.role || 'sales rep',
        expected_weekly_coverage: salesRep.expected_weekly_coverage,
        basic_salary: salesRep.basic_salary,
        status: salesRep.status ?? 1,
      });
    } else {
      setFormData({
        name: '',
        email: '',
        phoneNumber: '',
        country: '',
        region: '',
        route_name_update: '',
        photoUrl: '',
        role: 'sales rep',
        expected_weekly_coverage: undefined,
        basic_salary: undefined,
        status: 1,
      });
    }
  }, [salesRep]);

  // Load the extended profile (offer details, beneficiaries, etc.) when editing an existing rep
  useEffect(() => {
    if (!salesRep) {
      setProfile(emptyProfile());
      return;
    }
    let cancelled = false;
    setProfileLoading(true);
    salesService
      .getSalesRepProfile(salesRep.id)
      .then(p => { if (!cancelled) setProfile(normaliseProfile(p || {})); })
      .catch(() => { if (!cancelled) setProfile(emptyProfile()); })
      .finally(() => { if (!cancelled) setProfileLoading(false); });
    return () => { cancelled = true; };
  }, [salesRep]);

  const goBack = () => navigate('/sales-reps');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isTeamLeaderUser) return;
    setLoading(true);
    setSubmitError(null);
    const data = { ...formData, profile: cleanProfile(profile) };
    try {
      if (salesRep) {
        await salesService.updateSalesRep({ ...data, id: salesRep.id });
        if (data.status !== undefined && data.status !== salesRep.status) {
          await salesService.updateSalesRepStatus(salesRep.id, data.status);
        }
      } else {
        await salesService.createSalesRep(data);
      }
      goBack();
    } catch (err: any) {
      // Stay on the page and show the reason (e.g. a duplicate phone number)
      setSubmitError(err.response?.data?.error || err.message || 'Failed to save staff member');
      setLoading(false);
    }
  };

  if (isTeamLeaderUser) {
    return (
      <div className="p-6 text-xs text-gray-600">
        You don't have permission to add or edit staff.{' '}
        <Link to="/sales-reps" className="text-red-600 hover:underline">Back to staff</Link>
      </div>
    );
  }

  if (repLoading) {
    return <div className="p-6 text-xs text-gray-500">Loading staff member...</div>;
  }

  if (loadError) {
    return (
      <div className="p-6 text-xs">
        <p className="text-red-600 mb-2">{loadError}</p>
        <Link to="/sales-reps" className="text-red-600 hover:underline">Back to staff</Link>
      </div>
    );
  }

  const inputClass =
    'block w-full border border-gray-200 rounded-lg px-3 py-2 text-xs bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:bg-gray-50 disabled:text-gray-400';
  const labelClass = 'block text-[11px] font-medium text-gray-700 mb-1';
  const sectionClass = 'text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3';
  const cardClass = 'rounded-lg border border-gray-200 p-4';

  const ROLE_OPTIONS = [
    { value: 'sales rep', label: 'Sales Rep' },
    { value: 'team leader', label: 'Team Leader' },
    { value: 'driver', label: 'Driver' },
  ];
  const currentRole = formData.role || 'sales rep';

  const setP = (field: keyof SalesRepProfile, value: any) => setProfile(prev => ({ ...prev, [field]: value }));
  const setRow = (list: RowList, index: number, field: string, value: string) =>
    setProfile(prev => {
      const rows = [...((prev[list] as any[]) || [])];
      rows[index] = { ...rows[index], [field]: value };
      return { ...prev, [list]: rows };
    });

  const textField = (label: string, field: keyof SalesRepProfile, type = 'text', placeholder = '') => (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        type={type}
        value={(profile[field] as string) || ''}
        onChange={e => setP(field, e.target.value)}
        className={inputClass}
        placeholder={placeholder}
      />
    </div>
  );

  const rowInput = (list: RowList, i: number, field: string, value: string, label: string, type = 'text', placeholder = '', wide = false) => (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <label className={labelClass}>{label}</label>
      <input type={type} value={value} onChange={e => setRow(list, i, field, e.target.value)} className={inputClass} placeholder={placeholder} />
    </div>
  );

  const contactRows = (list: 'beneficiaries' | 'emergency_contacts' | 'family', title: string, relationships: string[]) => (
    <div className="space-y-4">
      {((profile[list] as ContactEntry[]) || []).map((row, i) => (
        <div key={i} className={cardClass}>
          <p className={sectionClass}>{title} {i + 1}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {rowInput(list, i, 'name', row.name, 'Name', 'text', 'Full name')}
            <div>
              <label className={labelClass}>Relationship</label>
              <select value={row.relationship} onChange={e => setRow(list, i, 'relationship', e.target.value)} className={inputClass}>
                <option value="">Select relationship</option>
                {withCurrent(relationships, row.relationship).map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            {rowInput(list, i, 'contact', row.contact, 'Contact', 'tel', '+254 700 000 000')}
          </div>
        </div>
      ))}
    </div>
  );

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    const body = new FormData();
    body.append('photo', file);
    try {
      const res = await fetch('/api/sales/sales-reps/upload-photo', { method: 'POST', body });
      const data = await res.json();
      if (data.url) {
        setFormData(prev => ({ ...prev, photoUrl: data.url }));
      } else {
        setUploadError(data.error || 'Upload failed');
      }
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed');
    }
    setUploading(false);
    e.target.value = '';
  };

  const initials = (formData.name || '').trim().charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4 sm:px-6">
      <div className="w-full">
        <div className="mb-4 flex items-center gap-2 text-[11px] text-gray-500">
          <Link to="/sales-reps" className="hover:text-red-600">Staff</Link>
          <span>/</span>
          <span className="text-gray-800">{salesRep ? salesRep.name || 'Edit' : 'New'}</span>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center flex-shrink-0">
              {formData.photoUrl ? (
                <img src={formData.photoUrl} alt="Preview" className="h-full w-full object-cover" />
              ) : (
                <span className="text-base font-semibold text-gray-400">{initials || '?'}</span>
              )}
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">{salesRep ? 'Edit Staff' : 'Add New Staff'}</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {salesRep ? 'Update this staff member\'s details.' : 'Add a sales rep, team leader or driver.'}
              </p>
              <div className="mt-1.5 flex items-center">
                <label className="inline-block px-3 py-1 rounded-lg text-[11px] font-medium border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
                  {uploading ? 'Uploading...' : formData.photoUrl ? 'Change photo' : 'Upload photo'}
                  <input type="file" accept="image/*" onChange={handlePhotoChange} disabled={uploading} className="hidden" />
                </label>
                {formData.photoUrl && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, photoUrl: '' })}
                    className="ml-2 text-[11px] text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                )}
              </div>
              {uploadError && <p className="text-[11px] text-red-600 mt-1">{uploadError}</p>}
            </div>
          </div>
          <button type="button" onClick={goBack} className="text-[11px] text-gray-500 hover:text-gray-800 transition-colors">
            &larr; Back to staff
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 overflow-x-auto flex-shrink-0 sticky top-0 bg-white z-10">
          <div className="flex space-x-1 px-6 min-w-max">
            {MODAL_TABS.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-3 text-[11px] font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-red-600 text-red-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="px-6 py-5 space-y-6 min-h-[420px]">
            {profileLoading && <p className="text-[11px] text-gray-400">Loading saved details...</p>}

            {/* Personal Details */}
            {activeTab === 'personal' && (
              <>
                <div>
                  <p className={sectionClass}>Role</p>
                  <div className="grid grid-cols-3 gap-2">
                    {ROLE_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, role: opt.value })}
                        className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                          currentRole === opt.value
                            ? 'bg-red-600 text-white border-red-600'
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className={sectionClass}>Personal details</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className={labelClass}>Name <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        className={inputClass}
                        placeholder="Full name"
                      />
                    </div>
                    {textField('ID Number', 'id_no', 'text', '123456789')}
                    <div>
                      <label className={labelClass}>Gender</label>
                      <select value={profile.gender || ''} onChange={e => setP('gender', e.target.value)} className={inputClass}>
                        <option value="">Select gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Phone Number <span className="text-red-500">*</span></label>
                      <input
                        type="tel"
                        required
                        value={formData.phoneNumber}
                        onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })}
                        className={inputClass}
                        placeholder="e.g. 0712 345 678"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Email <span className="text-red-500">*</span></label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                        className={inputClass}
                        placeholder="name@example.com"
                      />
                    </div>
                    {textField('Date of Birth', 'date_of_birth', 'date')}
                    <div>
                      <label className={labelClass}>Marital Status</label>
                      <select value={profile.marital_status || ''} onChange={e => setP('marital_status', e.target.value)} className={inputClass}>
                        <option value="">Select status</option>
                        <option value="Single">Single</option>
                        <option value="Married">Married</option>
                        <option value="Divorced">Divorced</option>
                        <option value="Widowed">Widowed</option>
                      </select>
                    </div>
                    {textField('Nationality', 'nationality', 'text', 'e.g., Kenyan')}
                    <div className="sm:col-span-2">
                      <label className={labelClass}>Address</label>
                      <textarea
                        rows={2}
                        value={profile.address || ''}
                        onChange={e => setP('address', e.target.value)}
                        className={inputClass}
                        placeholder="Enter full address"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Offer Details */}
            {activeTab === 'offer' && (
              <>
                <div>
                  <p className={sectionClass}>Offer details</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {textField('Employee Number', 'empl_no', 'text', 'EMP001')}
                    {textField('Designation', 'designation', 'text', 'e.g., Sales Representative')}
                    <div>
                      <label className={labelClass}>Employment Type</label>
                      <select value={profile.employment_type || ''} onChange={e => setP('employment_type', e.target.value)} className={inputClass}>
                        <option value="Consultant">Consultant</option>
                        <option value="Contract">Contract</option>
                        <option value="Permanent">Permanent</option>
                        <option value="Probation">Probation</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Basic Salary</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.basic_salary ?? ''}
                        onChange={e => setFormData({ ...formData, basic_salary: e.target.value ? Number(e.target.value) : undefined })}
                        className={inputClass}
                        placeholder="Enter basic salary"
                      />
                    </div>
                    {textField('Offer Date', 'offer_date', 'date')}
                    {textField('Start Date', 'start_date', 'date')}
                    {textField('Department Email', 'department_email', 'email', 'hr@company.com')}
                    <div>
                      <label className={labelClass}>Expected Weekly Coverage</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={formData.expected_weekly_coverage ?? ''}
                        onChange={e => setFormData({ ...formData, expected_weekly_coverage: e.target.value ? Number(e.target.value) : undefined })}
                        className={inputClass}
                        placeholder="Enter number"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <p className={sectionClass}>Benefits</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {(profile.benefits || []).map((b, i) => (
                      <div key={i}>
                        <label className={labelClass}>Benefit {i + 1}</label>
                        <input
                          type="text"
                          value={b}
                          onChange={e => {
                            const next = [...(profile.benefits || [])];
                            next[i] = e.target.value;
                            setP('benefits', next);
                          }}
                          className={inputClass}
                          placeholder={['e.g., Medical Insurance', 'e.g., Transport Allowance', 'e.g., Annual Leave'][i]}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className={sectionClass}>Location &amp; route</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className={labelClass}>Country</label>
                      <select
                        value={formData.country}
                        onChange={e => setFormData({ ...formData, country: e.target.value, region: '' })}
                        className={inputClass}
                      >
                        <option value="">Select country</option>
                        {countries.map(c => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Region</label>
                      <select
                        value={formData.region}
                        onChange={e => setFormData({ ...formData, region: e.target.value })}
                        className={inputClass}
                        disabled={!formData.country}
                      >
                        <option value="">{formData.country ? 'Select region' : 'Select country first'}</option>
                        {regions.map(r => (
                          <option key={r.id} value={r.name}>{r.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Route</label>
                      <select
                        value={formData.route_name_update}
                        onChange={e => setFormData({ ...formData, route_name_update: e.target.value })}
                        className={inputClass}
                      >
                        <option value="">Select route</option>
                        {routes.map(r => (
                          <option key={r.id} value={r.name}>{r.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5">
                  <div>
                    <p className="text-xs font-medium text-gray-800">Status</p>
                    <p className="text-[11px] text-gray-500">{formData.status === 1 ? 'Active' : 'Inactive'}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={formData.status === 1}
                    onClick={() => setFormData({ ...formData, status: formData.status === 1 ? 0 : 1 })}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      formData.status === 1 ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        formData.status === 1 ? 'translate-x-4' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
              </>
            )}

            {activeTab === 'beneficiary' && contactRows('beneficiaries', 'Beneficiary', BENEFICIARY_RELATIONSHIPS)}
            {activeTab === 'emergency' && contactRows('emergency_contacts', 'Emergency Contact', FAMILY_RELATIONSHIPS)}
            {activeTab === 'family' && contactRows('family', 'Family Member', FAMILY_RELATIONSHIPS)}

            {/* Statutory Details */}
            {activeTab === 'statutory' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {textField('SHIF Number', 'nhif_number', 'text', 'SHIF number')}
                {textField('NSSF Number', 'nssf_number', 'text', 'NSSF number')}
                {textField('KRA PIN', 'kra_pin', 'text', 'A000000000X')}
                {textField('Passport Number', 'passport_number', 'text', 'Passport number')}
              </div>
            )}

            {/* Bank Details */}
            {activeTab === 'bank' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {textField('Bank Name', 'bank_name', 'text', 'e.g., Equity Bank')}
                {textField('Bank Branch', 'bank_branch', 'text', 'Branch')}
                {textField('Account Number', 'account_number', 'text', 'Account number')}
                {textField('Account Name', 'account_name', 'text', 'Account name')}
                {textField('SWIFT Code', 'swift_code', 'text', 'SWIFT code')}
              </div>
            )}

            {/* Education Details */}
            {activeTab === 'education' && (
              <div className="space-y-4">
                {(profile.education || []).map((row, i) => (
                  <div key={i} className={cardClass}>
                    <p className={sectionClass}>Education {i + 1}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {rowInput('education', i, 'institution', row.institution, 'Institution', 'text', 'Institution name')}
                      {rowInput('education', i, 'qualification', row.qualification, 'Qualification', 'text', 'e.g., Diploma in Sales')}
                      {rowInput('education', i, 'year', row.year, 'Year', 'text', 'e.g., 2020')}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Work Experience */}
            {activeTab === 'experience' && (
              <div className="space-y-4">
                {(profile.work_experience || []).map((row, i) => (
                  <div key={i} className={cardClass}>
                    <p className={sectionClass}>Experience {i + 1}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {rowInput('work_experience', i, 'organization', row.organization, 'Organization', 'text', 'Company name')}
                      {rowInput('work_experience', i, 'designation', row.designation, 'Designation', 'text', 'Job title')}
                      {rowInput('work_experience', i, 'from', row.from, 'From', 'date')}
                      {rowInput('work_experience', i, 'to', row.to, 'To', 'date')}
                      {rowInput('work_experience', i, 'reason', row.reason, 'Reason for Leaving', 'text', 'Reason for leaving', true)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* References */}
            {activeTab === 'references' && (
              <div className="space-y-4">
                {(profile.references || []).map((row, i) => (
                  <div key={i} className={cardClass}>
                    <p className={sectionClass}>Reference {i + 1}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {rowInput('references', i, 'name', row.name, 'Name', 'text', 'Full Name')}
                      {rowInput('references', i, 'position', row.position, 'Position', 'text', 'Job Title')}
                      {rowInput('references', i, 'company', row.company, 'Company', 'text', 'Company name')}
                      {rowInput('references', i, 'phone', row.phone, 'Phone', 'tel', '+254 700 000 000')}
                      {rowInput('references', i, 'email', row.email, 'Email', 'email', 'email@example.com', true)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {submitError && (
            <div className="mx-6 mb-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">{submitError}</div>
          )}
          <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between gap-2 sticky bottom-0 bg-white rounded-b-2xl">
            <p className="text-[11px] text-gray-400">Name, email and phone are required. Everything else is optional.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={goBack}
                className="px-4 py-2 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || uploading || profileLoading}
                className="px-4 py-2 rounded-lg text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Saving...' : salesRep ? 'Update' : 'Add Staff'}
              </button>
            </div>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
};

export default SalesRepFormPage;
