#!/bin/bash

################################################################################
### Globals
################################################################################
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

ARCH_DEPENDENCIES=
DEBIAN_DEPENDENCIES=
DEPENDENCIES=(zsh bash emacs vim git cmake llvm clang wget ttf-hack)

################################################################################
### GUI and Shell
################################################################################

# Install GUI?
read -p "Set up GUI? (y/n) " yesorno
case $yesorno in
    y)
        GUI=1
        ;;
    *)
        GUI=0
        ;;
esac

if [ $GUI -eq 1 ]; then
    DEPENDENCIES+=(i3 xorg xorg-xinit rxvt-unicode xterm)
fi

# Installing dependencies
echo "Installing ${DEPENDENCIES[*]}"
if cat /etc/os-release | grep -qE "(Ubuntu|Debian)"; then
    sudo apt-get install ${DEPENDENCIES[*]} ${DEBIAN_DEPENDENCIES[*]}
elif cat /etc/os-release | grep -qE "Arch"; then
    sudo pacman -S ${DEPENDENCIES[*]} ${ARCH_DEPENDENCIES[*]}
else
    echo "Cannot determin distro"
fi
    
# Check if zsh is default
if [[ "$(getent passwd $USER | cut -d: -f7)" = *"zsh"* ]]
then
    echo "zsh is already the default shell"
else
    if command -v zsh > /dev/null 2>&1
    then
        read -p "Make zsh the default shell? (y/n) " yesorno
        case $yesorno in
            y)
                ZSH_PATH=`which zsh`
                echo "setting zsh as default shell"
                chsh $USER -s $ZSH_PATH
                ;;
            *)
                echo "zsh will not be set to default"
                ;;
        esac
    else
        echo "zsh is not installed. skipping chsh"
    fi
fi


################################################################################
### Dotfiles
################################################################################

# link zshrc config
if [ -e "$HOME/.zshrc" ]
then
    echo ".zshrc already exists. skipping..."
else
    read -p "set up $HOME/.zshrc? (y/n) " yesorno
    case $yesorno in
        y) ln -s "$DIR/zshrc" "$HOME/.zshrc" ;;
        *) echo "skipping $HOME/.zshrc"
    esac
fi

# link emacs config
if [ -e "$HOME/.emacs.d" ]
then
    echo ".emacs.d already exists. skipping..."
else
    read -p "set up $HOME/.emacs.d? (y/n) " yesorno
    case $yesorno in
        y) ln -ds "$DIR/emacs.d" "$HOME/.emacs.d" ;;
        *) echo "skipping $HOME/.emacs.d"
    esac
fi

# link vimrc config
if [ -e "$HOME/.vimrc" ]
then
    echo ".vimrc already exists. skipping..."
else
    read -p "set up $HOME/.vimrc? (y/n) " yesorno
    case $yesorno in
        y) ln -s "$DIR/vimrc" "$HOME/.vimrc" ;;
        *) echo "skipping $HOME/.vimrc"
    esac
fi

# link xinitrc config
if [ -e "$HOME/.xinitrc" ]
then
    echo ".xinitrc already exists. skipping..."
else
    read -p "set up $HOME/.xinitrc? (y/n) " yesorno
    case $yesorno in
        y) ln -s "$DIR/xinitrc" "$HOME/.xinitrc" ;;
        *) echo "skipping $HOME/.xinitrc"
    esac
fi

# link Xresources config
if [ -e "$HOME/.Xresources" ]
then
    echo ".Xresources already exists. skipping..."
else
    read -p "set up $HOME/.Xresources? (y/n) " yesorno
    case $yesorno in
        y) ln -s "$DIR/Xresources" "$HOME/.Xresources" ;;
        *) echo "skipping $HOME/.Xresources"
    esac
fi

read -p "install stack? (y/n) " yesorno
case $yesorno in
    y) wget -qO- https://get.haskellstack.org/ | sh ;;
    *) echo "skipping stack installation"
esac
