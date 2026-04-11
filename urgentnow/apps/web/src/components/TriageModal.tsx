'use client';

import { useState } from 'react';
import type { Facility } from '@urgentnow/types';

interface TriageNode {
  id: string;
  question: string;
  options: TriageOptionItem[];
}

interface TriageOptionItem {
  label: string;
  sublabel?: string;
  nextId?: string;
  result?: {
    type: Facility['type'] | 'ED_EMERGENCY';
    urgency: 'low' | 'medium' | 'high' | 'critical';
    headline: string;
    detail: string;
  };
}

const TRIAGE_TREE: Record<string, TriageNode> = {
  root: {
    id: 'root',
    question: 'What is your main concern right now?',
    options: [
      {
        label: 'Chest pain or trouble breathing',
        sublabel: 'Tightness, pressure, shortness of breath',
        result: {
          type: 'ED_EMERGENCY',
          urgency: 'critical',
          headline: 'Call 000 now',
          detail: 'These symptoms may indicate a heart attack or respiratory emergency. Do not drive yourself — call triple zero immediately.',
        },
      },
      {
        label: 'Injury — cuts, burns, fractures',
        sublabel: 'Including falls, sports injuries',
        nextId: 'injury',
      },
      {
        label: 'Severe pain or high fever',
        sublabel: 'Unbearable, unmanageable symptoms',
        nextId: 'severePain',
      },
      {
        label: 'Mild illness — cold, flu, infection',
        sublabel: 'Fever under 39°C, sore throat, earache',
        nextId: 'mildIllness',
      },
      {
        label: 'Medication or prescription',
        sublabel: 'Refill, OTC advice, minor ailment',
        result: {
          type: 'pharmacy',
          urgency: 'low',
          headline: 'Head to a pharmacy',
          detail: 'A pharmacist can help with prescriptions, OTC medications, and advice on minor ailments without a wait.',
        },
      },
      {
        label: "Mental health crisis — I'm not safe",
        sublabel: '',
        result: {
          type: 'ED_EMERGENCY',
          urgency: 'critical',
          headline: 'Call 000 or Lifeline 13 11 14',
          detail: "You are not alone. Call 000 for immediate help, or Lifeline on 13 11 14 (24/7). Going to an ED is also the right choice.",
        },
      },
    ],
  },
  injury: {
    id: 'injury',
    question: 'How severe is the injury?',
    options: [
      {
        label: 'Severe — deep wound, possible fracture, won\'t stop bleeding',
        result: {
          type: 'hospital',
          urgency: 'high',
          headline: 'Go to the emergency room',
          detail: 'Serious injuries need X-rays, stitches, or specialist care. Head to the nearest ED now.',
        },
      },
      {
        label: 'Moderate — can bear weight, bleeding is controlled',
        result: {
          type: 'urgentCare',
          urgency: 'medium',
          headline: 'Urgent care clinic is suitable',
          detail: 'An urgent care centre can treat sprains, minor fractures, lacerations, and wounds — usually faster than an ED.',
        },
      },
      {
        label: 'Minor — superficial cut, mild sprain',
        result: {
          type: 'pharmacy',
          urgency: 'low',
          headline: 'A pharmacy can help',
          detail: 'Pharmacists stock first aid supplies and can dress minor wounds. See a GP if it doesn\'t improve.',
        },
      },
    ],
  },
  severePain: {
    id: 'severePain',
    question: 'How long have you had these symptoms?',
    options: [
      {
        label: 'Started suddenly in the last few hours',
        result: {
          type: 'hospital',
          urgency: 'high',
          headline: 'Go to the emergency room',
          detail: 'Sudden severe pain can signal a serious condition like appendicitis or kidney stones. An ED has the diagnostics to rule these out.',
        },
      },
      {
        label: 'Building over a day or two',
        result: {
          type: 'urgentCare',
          urgency: 'medium',
          headline: 'Urgent care or GP',
          detail: 'An urgent care clinic can assess you and order tests. If you have a GP, call them first — they may have same-day availability.',
        },
      },
    ],
  },
  mildIllness: {
    id: 'mildIllness',
    question: 'Do any of these apply?',
    options: [
      {
        label: 'Child under 3 months with a fever',
        result: {
          type: 'hospital',
          urgency: 'high',
          headline: 'Go to the emergency room',
          detail: 'Fever in very young babies requires immediate medical assessment.',
        },
      },
      {
        label: 'Adult with fever over 39°C for more than 24 hours',
        result: {
          type: 'urgentCare',
          urgency: 'medium',
          headline: 'Urgent care clinic',
          detail: 'A persistent high fever should be assessed by a doctor who can check for infection and prescribe antibiotics if needed.',
        },
      },
      {
        label: 'None of the above — just feeling unwell',
        result: {
          type: 'pharmacy',
          urgency: 'low',
          headline: 'Try a pharmacy first',
          detail: 'A pharmacist can recommend symptom relief for colds, flu, and minor infections. See a GP if you don\'t improve in 48 hours.',
        },
      },
    ],
  },
};

const URGENCY_COLORS = {
  critical: { bg: '#FEE2E2', border: '#E63946', text: '#B91C1C', icon: '🚨' },
  high: { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E', icon: '⚡' },
  medium: { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E', icon: '⏱' },
  low: { bg: '#D1FAE5', border: '#10B981', text: '#065F46', icon: '✓' },
};

interface TriageModalProps {
  onResult: (type: Facility['type'] | 'ED_EMERGENCY') => void;
  onClose: () => void;
}

export function TriageModal({ onResult, onClose }: TriageModalProps) {
  const [currentId, setCurrentId] = useState('root');
  const [history, setHistory] = useState<string[]>([]);
  const [result, setResult] = useState<TriageOptionItem['result'] | null>(null);

  const node = TRIAGE_TREE[currentId];

  const handleOption = (option: TriageOptionItem) => {
    if (option.result) {
      setResult(option.result);
    } else if (option.nextId) {
      setHistory((h) => [...h, currentId]);
      setCurrentId(option.nextId);
    }
  };

  const handleBack = () => {
    if (result) {
      setResult(null);
      return;
    }
    const prev = history[history.length - 1];
    if (prev) {
      setHistory((h) => h.slice(0, -1));
      setCurrentId(prev);
    }
  };

  const urgencyStyle = result ? URGENCY_COLORS[result.urgency] : null;

  return (
    <div className="triage-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="triage-modal">
        {/* Header */}
        <div className="triage-header">
          <div className="triage-header-left">
            {(history.length > 0 || result) && (
              <button className="back-btn" onClick={handleBack}>← Back</button>
            )}
            <h2 className="triage-title">What do I need?</h2>
          </div>
          <button className="triage-close" onClick={onClose}>✕</button>
        </div>

        {/* Disclaimer */}
        <div className="triage-disclaimer">
          For life-threatening emergencies, call <strong>000</strong> immediately. This tool provides guidance only.
        </div>

        {/* Result view */}
        {result ? (
          <div className="triage-result">
            <div
              className="result-banner"
              style={{ background: urgencyStyle!.bg, borderColor: urgencyStyle!.border }}
            >
              <span className="result-icon" style={{ fontSize: 24 }}>{urgencyStyle!.icon}</span>
              <div>
                <p className="result-headline" style={{ color: urgencyStyle!.text }}>
                  {result.headline}
                </p>
                <p className="result-detail">{result.detail}</p>
              </div>
            </div>

            {result.type !== 'ED_EMERGENCY' && (
              <button
                className="find-btn"
                onClick={() => onResult(result.type)}
              >
                Show me nearby {result.type === 'hospital' ? 'emergency rooms' : result.type === 'urgentCare' ? 'urgent care clinics' : 'pharmacies'} →
              </button>
            )}

            {result.type === 'ED_EMERGENCY' && (
              <div className="emergency-actions">
                <a href="tel:000" className="call-btn">Call 000</a>
                <button className="find-btn secondary" onClick={() => onResult('hospital')}>
                  Show nearest ED →
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Question view */
          <div className="triage-question">
            <p className="question-text">{node.question}</p>
            <div className="options-list">
              {node.options.map((opt, i) => (
                <button
                  key={i}
                  className="option-btn"
                  onClick={() => handleOption(opt)}
                >
                  <span className="option-label">{opt.label}</span>
                  {opt.sublabel && <span className="option-sub">{opt.sublabel}</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
