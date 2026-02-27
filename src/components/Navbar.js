'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import styles from './Navbar.module.css';

const NAV_ITEMS = [
  { href: '/', label: 'Home', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href: '/create-select', label: 'Create', icon: 'M12 4v16m8-8H4' },
  { href: '/marketplace', label: 'Marketplace', icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z' },
  { href: '/profile', label: 'My Profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
];

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [didSearch, setDidSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  const router = useRouter();
  const pathname = usePathname();

  const handleDIDSearch = (e) => {
    e.preventDefault();
    const q = didSearch.trim();
    if (!q) return;
    router.push(`/did?q=${encodeURIComponent(q)}`);
    setDidSearch('');
    setSearchFocused(false);
    setIsMenuOpen(false);
  };

  return (
    <nav className={styles.navbar}>
      <div className={styles.container}>
        <div className={styles.navContent}>
          <Link href="/" className={styles.logo}>
            <div className={styles.logoIcon}>
              <Image
                src="/anft.png"
                alt="ANFT Logo"
                width={50}
                height={50}
                className={styles.logoImage}
                priority
              />
            </div>
            <span className={styles.logoBadge}>ANFT</span>
          </Link>

          <div className={styles.desktopNav}>
            {NAV_ITEMS.map(({ href, label, icon }) => (
              <Link
                key={href}
                href={href}
                className={`${styles.navLink} ${pathname === href ? styles.navLinkActive : ''}`}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
                </svg>
                <span>{label}</span>
              </Link>
            ))}
          </div>

          <div className={styles.rightSection}>
            <form onSubmit={handleDIDSearch} className={`${styles.searchForm} ${searchFocused ? styles.searchFormFocused : ''}`}>
              <svg className={styles.searchIcon} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={didSearch}
                onChange={(e) => setDidSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Search creator..."
                className={styles.searchInput}
              />
              {didSearch && (
                <button type="submit" className={styles.searchSubmit} aria-label="Search">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              )}
            </form>

            {mounted && <WalletMultiButton className={styles.walletBtn} />}

            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={styles.mobileMenuBtn}
              aria-label="Toggle menu"
            >
              <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {isMenuOpen && (
          <div className={styles.mobileMenu}>
            {NAV_ITEMS.map(({ href, label, icon }) => (
              <Link
                key={href}
                href={href}
                className={`${styles.mobileLink} ${pathname === href ? styles.mobileLinkActive : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
                </svg>
                <span>{label}</span>
              </Link>
            ))}
            <div className={styles.mobileDivider} />
            <form onSubmit={handleDIDSearch} className={styles.mobileSearchForm}>
              <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={didSearch}
                onChange={(e) => setDidSearch(e.target.value)}
                placeholder="Search creator or DID..."
                className={styles.mobileSearchInput}
              />
            </form>
            <div className={styles.mobileWallet}>
              {mounted && <WalletMultiButton className={styles.walletBtn} />}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
