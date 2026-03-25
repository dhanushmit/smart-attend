import { motion } from 'framer-motion';

const GlassCard = ({ children, className = "", delay = 0, ...props }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ type: 'spring', damping: 20, stiffness: 100, delay }}
      className={`glass-card ultra-rounded p-8 border-white/10 ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export default GlassCard;
