import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, MapPin, Code2, Briefcase, DollarSign, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface OnboardingData {
  location:   string;
  role:       string;
  skills:     string[];
  experience: string;
  salaryMin:  string;
}

const EXPERIENCE_OPTIONS = [
  { value: 'junior',   label: 'Junior',   sub: '0–2 years' },
  { value: 'mid',      label: 'Mid',      sub: '2–5 years' },
  { value: 'senior',   label: 'Senior',   sub: '5+ years' },
  { value: 'lead',     label: 'Lead',     sub: 'Team lead / Principal' },
];

const STEPS = [
  { id: 'location',   icon: MapPin,     title: 'Where are you based?',     desc: 'We\'ll prioritise jobs in your area.' },
  { id: 'role',       icon: Briefcase,  title: 'What role are you targeting?', desc: 'e.g. Full Stack Developer, Data Analyst' },
  { id: 'skills',     icon: Code2,      title: 'Your top skills',          desc: 'Add your strongest skills for better matches.' },
  { id: 'experience', icon: Zap,        title: 'Experience level',         desc: 'Helps us match you to the right seniority.' },
  { id: 'salary',     icon: DollarSign, title: 'Salary expectation',       desc: 'We\'ll filter out roles below your target.' },
];

export default function Onboarding() {
  const { user, updateProfile } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [skillInput, setSkillInput] = useState('');
  const [data, setData] = useState<OnboardingData>({
    location:   '',
    role:       '',
    skills:     [],
    experience: '',
    salaryMin:  '',
  });

  const totalSteps = STEPS.length;
  const progress = ((step) / (totalSteps - 1)) * 100;
  const currentStep = STEPS[step];
  const StepIcon = currentStep.icon;

  const addSkill = () => {
    const s = skillInput.trim();
    if (s && !data.skills.includes(s)) {
      setData((d) => ({ ...d, skills: [...d.skills, s] }));
    }
    setSkillInput('');
  };

  const removeSkill = (skill: string) =>
    setData((d) => ({ ...d, skills: d.skills.filter((sk) => sk !== skill) }));

  const canAdvance = (): boolean => {
    switch (currentStep.id) {
      case 'location':   return !!data.location.trim();
      case 'role':       return !!data.role.trim();
      case 'skills':     return data.skills.length > 0;
      case 'experience': return !!data.experience;
      case 'salary':     return true;
      default:           return true;
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      await updateProfile({
        location:            data.location,
        targetRole:          data.role,
        skills:              data.skills,
        experienceLevel:     data.experience,
        desiredSalaryMin:    data.salaryMin ? Number(data.salaryMin) : undefined,
        onboardingCompleted: true,
      });
      nav('/dashboard');
    } catch {
      toast.error('Could not save profile, please try again');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-2 flex flex-col">
      {/* Header */}
      <header className="h-14 px-6 flex items-center justify-between border-b border-border bg-surface">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-brand rounded-lg flex items-center justify-center">
            <Zap size={13} className="text-white" fill="white" />
          </div>
          <span className="font-bold text-sm">Career<span className="text-brand">Ops</span></span>
        </div>
        <span className="text-xs text-text-muted font-medium">
          Step {step + 1} of {totalSteps}
        </span>
      </header>

      {/* Progress bar */}
      <div className="h-1 bg-surface-3">
        <motion.div
          className="h-full bg-brand rounded-full"
          initial={false}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
        />
      </div>

      {/* Main */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Step indicators */}
          <div className="flex items-center justify-center gap-2 mb-10">
            {STEPS.map((s, i) => (
              <div
                key={s.id}
                className={cn(
                  'transition-all duration-300 rounded-full',
                  i < step  ? 'w-6 h-6 bg-brand flex items-center justify-center' :
                  i === step ? 'w-6 h-2 bg-brand' :
                               'w-2 h-2 bg-surface-3'
                )}
              >
                {i < step && <Check size={12} className="text-white" />}
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="space-y-6"
            >
              {/* Step header */}
              <div className="space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center">
                  <StepIcon size={22} className="text-brand" />
                </div>
                <h2 className="text-xl font-bold text-text-primary">{currentStep.title}</h2>
                <p className="text-sm text-text-muted">{currentStep.desc}</p>
              </div>

              {/* Step content */}
              {currentStep.id === 'location' && (
                <Input
                  placeholder="Dublin, Ireland"
                  value={data.location}
                  onChange={(e) => setData((d) => ({ ...d, location: e.target.value }))}
                  inputSize="lg"
                  autoFocus
                />
              )}

              {currentStep.id === 'role' && (
                <Input
                  placeholder="Full Stack Developer"
                  value={data.role}
                  onChange={(e) => setData((d) => ({ ...d, role: e.target.value }))}
                  inputSize="lg"
                  autoFocus
                />
              )}

              {currentStep.id === 'skills' && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      className="input flex-1"
                      placeholder="e.g. React, TypeScript"
                      value={skillInput}
                      onChange={(e) => setSkillInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
                    />
                    <Button variant="brand-subtle" size="md" onClick={addSkill} type="button">Add</Button>
                  </div>
                  {data.skills.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {data.skills.map((sk) => (
                        <span
                          key={sk}
                          className="chip-primary flex items-center gap-1.5 cursor-pointer hover:bg-danger-50 hover:text-danger-600 hover:border-danger-100 transition-colors"
                          onClick={() => removeSkill(sk)}
                        >
                          {sk} ×
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {currentStep.id === 'experience' && (
                <div className="grid grid-cols-2 gap-3">
                  {EXPERIENCE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setData((d) => ({ ...d, experience: opt.value }))}
                      className={cn(
                        'p-4 rounded-xl border-2 text-left transition-all duration-150',
                        data.experience === opt.value
                          ? 'border-brand bg-brand-50 text-brand'
                          : 'border-border bg-surface text-text-secondary hover:border-brand-200 hover:bg-brand-50/50'
                      )}
                    >
                      <p className="font-semibold text-sm">{opt.label}</p>
                      <p className="text-xs text-text-muted mt-0.5">{opt.sub}</p>
                    </button>
                  ))}
                </div>
              )}

              {currentStep.id === 'salary' && (
                <div className="space-y-2">
                  <Input
                    label="Minimum annual salary (€)"
                    type="number"
                    placeholder="50000"
                    value={data.salaryMin}
                    onChange={(e) => setData((d) => ({ ...d, salaryMin: e.target.value }))}
                    hint="Leave blank to see all salaries"
                    inputSize="lg"
                    autoFocus
                  />
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between pt-2">
                {step > 0 ? (
                  <Button
                    variant="ghost"
                    size="md"
                    leftIcon={<ArrowLeft size={15} />}
                    onClick={() => setStep((s) => s - 1)}
                  >
                    Back
                  </Button>
                ) : <div />}

                {step < totalSteps - 1 ? (
                  <Button
                    variant="primary"
                    size="md"
                    rightIcon={<ArrowRight size={15} />}
                    disabled={!canAdvance()}
                    onClick={() => setStep((s) => s + 1)}
                  >
                    Continue
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="md"
                    loading={saving}
                    rightIcon={<Check size={15} />}
                    onClick={handleFinish}
                  >
                    Finish setup
                  </Button>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
