export function isProtectedAdminPage(pathname: string): boolean {
  const isAdminPage = pathname === '/admin' || pathname.startsWith('/admin/')
  const isLoginPage = pathname === '/admin/login' || pathname === '/admin/login/'

  return isAdminPage && !isLoginPage
}
