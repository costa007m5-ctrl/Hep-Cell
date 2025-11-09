
import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="py-4 px-4 sm:px-6 lg:px-8 text-center">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        © {new Date().getFullYear()} Relp Cell. Todos os direitos reservados.
      </p>
    </footer>
  );
};

export default Footer;
