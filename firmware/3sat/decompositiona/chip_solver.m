% Function that accepts the smaller splits of the problem and returns the
% SAT solution of the big problem

% Input : 
% s_node : Starting node for decomposition
% G_chip1 : Nodes for 1st chip
% G_chip2 : Nodes for 2nd chip
% set1 : Clauses only for 1st chip
% set2 : Clauses only for 2nd chip
% inter : Common Clauses for both chips
% S: # of nodes
% Clauses : Set of all Clauses

%Output : 
% X_final : The final SAT states for all the variables 
% sat_time : Array to store the max time to reach sat solution for chip1
% and chip2 for an initial X
% flip_time : Array to store flipping time of the nodes based on k1 and k2 of the
% algorithm for an initial X 
% total_time : Array to store the total time to reach a SAT solution for
% the larger problem


function [X_final,sat_time,flip_time,total_time]=chip_solver(s_node,G_chip1,G_chip2,set1,set2,inter,S,Clauses)

X_final1=[];
X_final2=[];

G_chip1 =sort(G_chip1);
G_chip2 =sort(G_chip2);

o_G_chip1 = 1:size(G_chip1,2);
o_G_chip2 = 1:size(G_chip2,2);

map_1 = [G_chip1', o_G_chip1'];
map_2 = [G_chip2', o_G_chip2'];

comm = S- size(s_node,2);
o_G_chip = 1:comm;
G_chip= [1:S];

G_chip= setdiff(G_chip,s_node);
map = [G_chip', o_G_chip'];

[rows, cols] = size(set1);
for i = 1:rows
    for j = 1:cols
        if set1(i,j)<0
            set1(i,j)=-map_1(find(map_1(:, 1) == abs(set1(i,j))),2);
        else
            set1(i,j)=map_1(find(map_1(:, 1) == set1(i,j)),2);
        end
    end
end


[rows, cols] = size(set2);
for i = 1:rows
    for j = 1:cols
        if set2(i,j)<0
            set2(i,j)=-map_2(find(map_2(:, 1) == abs(set2(i,j))),2);
        else
            set2(i,j)=map_2(find(map_2(:, 1) == set2(i,j)),2);
        end
    end
end

[rows, cols] = size(inter);
for i = 1:rows
    for j = 1:cols
        if inter(i,j)<0
            inter(i,j)=-map(find(map(:, 1) == abs(inter(i,j))),2);
        else
            inter(i,j)=map(find(map(:, 1) == inter(i,j)),2);
        end
    end
end


K=10^4;
VC=1;
small_eps=0.00;
X_final=binornd(ones(S,1),0.5); % Uniformly generating initial state
X_initial = X_final;
vtmpb=100;
c=1;
time=[];
total_time=[];

% Simulating for K jumps
while(vtmpb~=0)

    %Solving each smaller chip to SAT sol
    if size(G_chip2,2)==0
        parts = 1;
    else
        parts = 2;
    end
    for p =1:parts
        if p==1
            N=size(G_chip1,2);
            X_final1=zeros(N,1);
            X = X_final(G_chip1);
            nc=size(set1,1);
        else
            N=size(G_chip2,2);
            X_final2=zeros(N,1);
            X = X_final(G_chip2);
            nc=size(set2,1);
        end

        L=zeros(N,1); % Initially all nodes have full current
        Lmax=max(L); % Initially equal to 0
        Y=X; % Size is N x (Lmax+1)

        rate_flag = zeros(N,K+1);
        QV = ones(K+1,N)/VC;

        L=zeros(N,1);
        Lmax=max(L);
        Y=X;
        TvalV=0;
        for i=2:K+1
            Xtmp=X;
            Ltmp=L;
            Lmaxtmp=Lmax;
            % XV(i,1:N)=X;
            % LV(i,1:N)=L;
            % LmaxV(i)=Lmax;

            if p==1
                [vtmpj,vtmp]=rnode_chip(N,X,small_eps,set1,nc);
            else
                [vtmpj,vtmp]=rnode_chip(N,X,small_eps,set2,nc);
            end
            q=0;
            for j=1:N
                tmp=1/VC;
                if vtmpj(j) ==0
                    rate_flag(j,i)=1;
                    q(j) =QV(i-1,j);
                    L(j)=L(j)+1;
                else
                    if L(j)>0
                        q(j)=min(min(vtmpj(j),3)*QV(i-1,j));
                    else
                        q(j)=min(vtmpj(j),3);
                    end
                end
            end
            % Termination condition when all rates are 0
            if vtmp==0
                break;
            end
            CFV(i)=sum(vtmp);
            QV(i,1:N)=q;
            times=exprnd(1./q);
            [r]=find(rate_flag(:,i)==0);
            [Tval,Ival]=min(times(r));
            if(i==2)
                TvalV(i)=Tval;
            else
                TvalV(i)=TvalV(i-1)+Tval;
            end
            for j=r'
                if(j==r(Ival)) % Node that switches
                    L(j)=0;
                    if X(j)==1
                        X(j)=0;
                    else
                        X(j)=1;
                    end
                else
                    L(j)=L(j)+1; % X components stay the same so no change
                end
            end
            Lmax=max(L);
        end
        if p==1
            X_final1=X;
        else
            X_final2=X;
        end
        time=[time,TvalV(end)];
    end


    for n=1:S
        if ismember(n,G_chip1)
            X_final(n)=X_final1(find(G_chip1==n));
        else
            X_final(n)=X_final2(find(G_chip2==n));
        end
    end

    X_final=X_final';
    removedArray = X_final(s_node);
    remainingArray = X_final;
    remainingArray(s_node) = [];
    X_inter = remainingArray;

    X_inter=X_inter';
    [vtmpx,vtmpb]=rnode_chip(size(X_inter,1),X_inter,small_eps,inter,size(inter,1));
    [~,vtmpt]=rnode_chip(size(X_final',1),X_final',small_eps,Clauses,size(Clauses,1));

    if vtmpb==0
        disp("Solution found");
        [~,vtmpt]=rnode_chip(size(X_final',1),X_final',small_eps,Clauses,size(Clauses,1));
        break;
    end
    vtmpf=100;
    vtmpa =100;
    flips=1;
    vtmpf_arr=[];
    X_flip=[];
    vtmpa_arr=[];
    Xf_flip=[];
    tic;
    
    while (vtmpb<vtmpf || vtmpt<vtmpa) && (flips ~=50)
        l_n= vtmpx;
        L1 = G_chip1(ismember(G_chip1, find(l_n>0)));
        L2 = G_chip2(ismember(G_chip2, find(l_n>0)));
        exp=exprnd(1./l_n);
        k1=ceil(size(L1,2)/2);
        k2=ceil(size(L2,2)/2);
        [~,pos1]= mink(exp(L1),k1);
        
        for s=pos1'
            if X_inter(L1(s)) == 1
                X_inter(L1(s)) = 0;
            else
                X_inter(L1(s)) = 1;
            end
        end
        [~,pos2]=mink(exp(L2),k2);

        for s=pos2'
            if X_inter(L2(s)) == 1
                X_inter(L2(s)) = 0;
            else
                X_inter(L2(s)) = 1;
            end
        end
        [~,vtmpf]=rnode_chip(size(X_inter,1),X_inter,small_eps,inter,size(inter,1));
        vtmpf_arr = [vtmpf_arr,vtmpf];
        X_flip= [X_flip,X_inter];
        flips = flips+1;
        X_final= X_inter';
        for i = 1:size(s_node,2)
            X_final = [X_final(1:s_node(i)-1), removedArray(i), X_final(s_node(i):end)];
        end
        X_final=X_final';
        [~,vtmpa]=rnode_chip(size(X_final,1),X_final,small_eps,Clauses,size(Clauses,1));
        vtmpa_arr = [vtmpa_arr,vtmpa];
        Xf_flip= [Xf_flip,X_final];
    end
    [~,pos]= find((vtmpf_arr==min(vtmpf_arr)) & (vtmpa_arr==min(vtmpa_arr)),1);
    if isempty(pos)
        [~,pos]=min(vtmpa_arr);
    end

    X_inter=X_flip(:,pos);
    X_final = Xf_flip(:,pos);

    sat_time(c) = max(time);
    flip_time(c)=toc;
    total_time(c) = sat_time(c)+flip_time(c);
    c=c+1;
end

end
