import React, { memo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ICONS } from '../constants';

export type ConfirmDialogVariant = 'danger' | 'warning' | 'success' | 'info';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmDialogVariant;
  icon?: React.ReactNode;
}

const variantStyles: Record<ConfirmDialogVariant, {
  bg: string;
  iconBg: string;
  iconColor: string;
  buttonBg: string;
  buttonHover: string;
}> = {
  danger: {
    bg: 'from-rose-50 to-red-50',
    iconBg: 'bg-rose-100',
    iconColor: 'text-rose-600',
    buttonBg: 'bg-rose-600',
    buttonHover: 'hover:bg-rose-700',
  },
  warning: {
    bg: 'from-amber-50 to-orange-50',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    buttonBg: 'bg-amber-600',
    buttonHover: 'hover:bg-amber-700',
  },
  success: {
    bg: 'from-emerald-50 to-green-50',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    buttonBg: 'bg-emerald-600',
    buttonHover: 'hover:bg-emerald-700',
  },
  info: {
    bg: 'from-indigo-50 to-blue-50',
    iconBg: 'bg-indigo-100',
    iconColor: 'text-indigo-600',
    buttonBg: 'bg-indigo-600',
    buttonHover: 'hover:bg-indigo-700',
  },
};

const ConfirmDialog: React.FC<ConfirmDialogProps> = memo(({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'warning',
  icon,
}) => {
  const styles = variantStyles[variant];

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleConfirm = useCallback(() => {
    onConfirm();
    onClose();
  }, [onConfirm, onClose]);

  const defaultIcon = variant === 'danger' ? (
    <ICONS.Trash2 size={24} />
  ) : variant === 'success' ? (
    <ICONS.CheckCircle2 size={24} />
  ) : variant === 'warning' ? (
    <ICONS.AlertCircle size={24} />
  ) : (
    <ICONS.Info size={24} />
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200]"
          />
          
          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 flex items-center justify-center z-[200] p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div 
              className={`bg-gradient-to-br ${styles.bg} rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden border border-white/50`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 text-center">
                <div className={`${styles.iconBg} w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${styles.iconColor}`}>
                  {icon || defaultIcon}
                </div>
                
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {title}
                </h3>
                
                <p className="text-gray-600 text-sm leading-relaxed">
                  {message}
                </p>
              </div>
              
              {/* Actions */}
              <div className="px-6 pb-6 flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-3 bg-white text-gray-700 rounded-xl font-semibold hover:bg-gray-100 active:bg-gray-200 transition-colors border border-gray-200"
                >
                  {cancelText}
                </button>
                <button
                  onClick={handleConfirm}
                  className={`flex-1 px-4 py-3 ${styles.buttonBg} text-white rounded-xl font-semibold ${styles.buttonHover} active:scale-95 transition-all shadow-lg`}
                >
                  {confirmText}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
});

ConfirmDialog.displayName = 'ConfirmDialog';

export default ConfirmDialog;

// Hook for easier usage
export function useConfirmDialog() {
  const [dialogState, setDialogState] = React.useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: ConfirmDialogVariant;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const showConfirm = useCallback((options: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: ConfirmDialogVariant;
    onConfirm: () => void;
  }) => {
    setDialogState({
      isOpen: true,
      ...options,
    });
  }, []);

  const hideConfirm = useCallback(() => {
    setDialogState(prev => ({ ...prev, isOpen: false }));
  }, []);

  const ConfirmDialogComponent = useCallback(() => (
    <ConfirmDialog
      isOpen={dialogState.isOpen}
      onClose={hideConfirm}
      onConfirm={dialogState.onConfirm}
      title={dialogState.title}
      message={dialogState.message}
      confirmText={dialogState.confirmText}
      cancelText={dialogState.cancelText}
      variant={dialogState.variant}
    />
  ), [dialogState, hideConfirm]);

  return {
    showConfirm,
    hideConfirm,
    ConfirmDialog: ConfirmDialogComponent,
  };
}

