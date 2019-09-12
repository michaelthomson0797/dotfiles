export TERM=xterm-256color
export PATH=/home/mthomson/.local/bin:$PATH
export BROWSER=qutebrowser
# Lines configured by zsh-newuser-install
HISTFILE=~/.histfile
HISTSIZE=1000
SAVEHIST=1000
bindkey -v
# End of lines configured by zsh-newuser-install
# The following lines were added by compinstall
zstyle :compinstall filename '/home/mthomson/.zshrc'

autoload -Uz compinit promptinit
compinit
promptinit

prompt redhat

zstyle ':completion:*' menu select
