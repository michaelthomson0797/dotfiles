" Michael Thomson

" Vundle {{{

" start vundle
filetype off
set rtp+=~/.vim/bundle/Vundle.vim
call vundle#begin()

" core plugins
Plugin 'VundleVim/Vundle.vim'
Plugin 'flazz/vim-colorschemes'
Plugin 'kien/ctrlp.vim'
Plugin 'sjl/gundo.vim'
Plugin 'scrooloose/nerdtree'
Plugin 'vim-airline/vim-airline'
Plugin 'valloric/youcompleteme'
Plugin 'xolox/vim-notes'
Plugin 'xolox/vim-misc'
Plugin 'easymotion/vim-easymotion'
Plugin 'tpope/vim-surround'

" Markdown
Plugin 'godlygeek/tabular'
Plugin 'plasticboy/vim-markdown'
Plugin 'vim-pandoc/vim-pandoc'

" tmux
Plugin 'christoomey/vim-tmux-navigator'

"YCM extra config
Plugin 'rdnetto/YCM-Generator'

" All of your Plugins must be added before the following line
call vundle#end()            " required
filetype plugin indent on    " required

" }}} 

" Colors {{{

colorscheme gruvbox " solarized colorscheme
set background=dark

syntax enable		" enable syntax processing

" }}}

" Spaces & Tabs {{{

set tabstop=4		" number of visual spaces per tab
set softtabstop=4	" number of spaces in tab while editing
set expandtab		" tabs are spaces

" }}}

" UI Config {{{

set laststatus=2    " makes statusline appear all the time
set guifont=Liberation\ Mono\ for\ PowerLine\ 10
let g:airline_powerline_fonts = 1
set number		" shows line numbers
set showcmd		" show command in bottom bar
set cursorline		" highlight current line
filetype indent on	" load filetype-specific indent files
set wildmenu		" visual autocomplete for command menu
set lazyredraw		" redraw only when we need to
set showmatch		" highlight matching [{()}]

" }}}

" Searching {{{

set incsearch 		" search as characters are entered
set hlsearch		" highlight matches
nnoremap <leader><space> :nohlsearch<CR>


" }}}

" Folding {{{

set foldenable		" enable folding
set foldlevelstart=0	" opens most folds by default
set foldnestmax=10	" 10 nested fold max
nnoremap <space> za
set foldmethod=marker	" fold based on indent level

" }}}

" Movement {{{

" move vertically by visual lines
nnoremap j gj
nnoremap k gk

" move to beginning/end of line
nnoremap B ^
nnoremap E $

" $/^ doesn't do anything
nnoremap $ <nop>
nnoremap ^ <nop>

" change windows with ctrl + direction
nnoremap <C-h> <C-w>h
nnoremap <C-j> <C-w>j
nnoremap <C-k> <C-w>k
nnoremap <C-l> <C-w>l

" }}}

" Leader Shortcuts {{{

let mapleader=","	" leader is a comma

" jk is escape
inoremap jk <esc>

" toggle gundo
nnoremap <leader>u :GundoToggle<CR>

"edit vimrc/zshrc and lead vimrc bindings
nnoremap <leader>ev :vsp $MYVIMRC<CR>
nnoremap <leader>ez :vsp ~/.zshrc<CR>
nnoremap <leader>sv :source $MYVIMRC<CR>

" super save session
nnoremap <leader>s :mksession<CR>

" convert current file to pdf
nnoremap <leader>c :!pandoc % -s -o %.pdf<CR>

" }}}

" CtrlP {{{

let g:ctrlp_match_window = 'bottom,order:ttb'
let g:ctrlp_switch_buffer = 0
let g:ctrlp_working_path_mode = 0

" }}}

" NerdTree {{{

" leader + f to toggle nerdtree
nnoremap <Leader>f :NERDTreeToggle<Enter>
" }}}

" Vim-notes {{{

let g:notes_directories = ['~/Notes']

" }}}

" EasyMotion {{{

" <Leader>f{char} to move to {char}
map  <Leader>s <Plug>(easymotion-bd-f)
nmap <Leader>s <Plug>(easymotion-overwin-f)

" Move to line
map <Leader>L <Plug>(easymotion-bd-jk)
nmap <leader>L <Plug>(easymotion-overwin-line)

" Move to word
map <Leader>w <Plug>(easymotion-bd-w)
nmap <Leader>w <Plug>(easymotion-overwin-w)

" }}}
set nocompatible 
set modelines=1
