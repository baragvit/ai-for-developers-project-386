import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderApp } from '@/test/render'

const header = () => within(screen.getByRole('banner'))

describe('Шапка', () => {
  it('ведёт логотипом на главную, а пунктом «Записаться» в каталог типов встреч', () => {
    renderApp('/')

    expect(header().getByRole('link', { name: 'Созвон' })).toHaveAttribute('href', '/')
    expect(header().getByRole('link', { name: /Записаться/ })).toHaveAttribute('href', '/book')
  })

  it.each(['/book', '/book/intro-call'])('подсвечивает «Записаться» на %s', (path) => {
    renderApp(path)

    expect(header().getByRole('link', { name: /Записаться/ })).toHaveAttribute('aria-current', 'page')
  })

  it('не подсвечивает «Записаться» на главной странице', () => {
    renderApp('/')

    expect(header().getByRole('link', { name: /Записаться/ })).not.toHaveAttribute('aria-current')
  })
})
