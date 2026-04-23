import React from 'react';
import { CheckCircle2, Circle } from 'lucide-react';

const PasswordStrengthMeter = ({ password }) => {
  // Criterios de validación
  const criteria = {
    length: {
      label: 'Al menos 8 caracteres',
      test: (pwd) => pwd.length >= 8,
      icon: true
    },
    lowercase: {
      label: 'Letras minúsculas (a-z)',
      test: (pwd) => /[a-z]/.test(pwd),
      icon: true
    },
    uppercase: {
      label: 'Letras mayúsculas (A-Z)',
      test: (pwd) => /[A-Z]/.test(pwd),
      icon: true
    },
    numbers: {
      label: 'Números (0-9)',
      test: (pwd) => /[0-9]/.test(pwd),
      icon: true
    },
    special: {
      label: 'Caracteres especiales (!@#$%^&*)',
      test: (pwd) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd),
      icon: true
    }
  };

  // Calcular fortaleza
  const passedCriteria = Object.values(criteria).filter(c => c.test(password)).length;
  const strength = password.length === 0 ? 0 : Math.ceil((passedCriteria / Object.keys(criteria).length) * 100);
  
  // Determinar nivel de fortaleza
  const getStrengthLevel = () => {
    if (strength === 0) return { label: '', color: '', bgColor: '' };
    if (strength <= 20) return { label: 'Muy débil', color: 'text-red-600', bgColor: 'bg-red-500' };
    if (strength <= 40) return { label: 'Débil', color: 'text-orange-600', bgColor: 'bg-orange-500' };
    if (strength <= 60) return { label: 'Regular', color: 'text-yellow-600', bgColor: 'bg-yellow-500' };
    if (strength <= 80) return { label: 'Buena', color: 'text-blue-600', bgColor: 'bg-blue-500' };
    return { label: 'Excelente', color: 'text-emerald-600', bgColor: 'bg-emerald-500' };
  };

  const strengthLevel = getStrengthLevel();

  return (
    <div className="mt-3 space-y-3">
      {/* Barra de fortaleza */}
      {password.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Fortaleza de contraseña
            </span>
            {strengthLevel.label && (
              <span className={`text-xs font-semibold ${strengthLevel.color}`}>
                {strengthLevel.label}
              </span>
            )}
          </div>
          <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${strengthLevel.bgColor}`}
              style={{ width: `${strength}%` }}
            />
          </div>
        </div>
      )}

      {/* Criterios de validación */}
      <div className="grid grid-cols-1 gap-2">
        {Object.entries(criteria).map(([key, criterion]) => {
          const isMet = criterion.test(password);
          return (
            <div
              key={key}
              className={`flex items-center space-x-2 text-sm transition-colors ${
                isMet
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : password.length > 0
                  ? 'text-slate-400 dark:text-slate-600'
                  : 'text-slate-500 dark:text-slate-500'
              }`}
            >
              {isMet ? (
                <CheckCircle2 size={16} className="flex-shrink-0" />
              ) : (
                <Circle size={16} className="flex-shrink-0" />
              )}
              <span>{criterion.label}</span>
            </div>
          );
        })}
      </div>

      {/* Indicador de coincidencia de contraseñas */}
      {password.length > 0 && (
        <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
            💡 Las contraseñas deben coincidir para registrarse
          </p>
        </div>
      )}
    </div>
  );
};

export default PasswordStrengthMeter;
