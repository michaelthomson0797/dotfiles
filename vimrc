" Vim-Plug {{{
if empty(glob('~/.vim/autoload/plug.vim'))
  silent !curl -fLo ~/.vim/autoload/plug.vim --create-dirs
    \ https://raw.githubusercontent.com/junegunn/vim-plug/master/plug.vim
  autocmd VimEnter * PlugInstall --sync | source $MYVIMRC
endif

call plug#begin('~/.vim/plugged')
Plug 'flazz/vim-colorschemes'
Plug 'vim-airline/vim-airline'
Plug 'vim-airline/vim-airline-themes'
Plug 'junegunn/goyo.vim'
Plug 'easymotion/vim-easymotion'
call plug#end()
" }}}
" Colors {{{
syntax enable
colorscheme badwolf
set termguicolors
" }}}
" Spaces & Tabs {{{
set tabstop=4
set expandtab
set softtabstop=4
set shiftwidth=4
set modelines=1
filetype indent on
filetype plugin on
set autoindent
" }}}
" UI Layout {{{
set number
set showcmd
set nocursorline
set wildmenu
set lazyredraw
set showmatch
" }}}
" Searching {{{
set ignorecase
set incsearch
set hlsearch
" }}}
" Folding {{{
set foldmethod=indent
set foldnestmax=10
set foldenable
nnoremap <space> za
set foldlevelstart=10
" }}}
" Leader {{{
let mapleader=","
" }}}
